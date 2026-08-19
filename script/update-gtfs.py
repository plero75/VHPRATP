import zipfile
import pandas as pd
import requests
from io import BytesIO
from datetime import datetime, timedelta
import json

GTFS_URL = "https://eu.ftp.opendatasoft.com/stif/GTFS/IDFM-gtfs.zip"

TARGETS = [
    {"nom": "Hippodrome de Vincennes", "parent_station": "IDFM:463642", "route_id": "IDFM:C02251", "ligne": "77"},
    {"nom": "École du Breuil", "parent_station": "IDFM:463645", "route_id": "IDFM:C01219", "ligne": "201"},
    {"nom": "École du Breuil", "parent_station": "IDFM:463645", "route_id": "IDFM:C02251", "ligne": "77"},
    {"nom": "Joinville-le-Pont", "parent_station": "IDFM:70640", "route_id": "STIF:Line::C01742:", "ligne": "RER A"},
]

WEEKDAY_COLUMNS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

today = datetime.now().date()
# Aujourd'hui + les deux jours suivants : premier/dernier passage et reprise
# du lendemain disponibles avant même le changement de date.
days = [today + timedelta(days=i) for i in range(3)]

resp = requests.get(GTFS_URL, timeout=60)
resp.raise_for_status()
z = zipfile.ZipFile(BytesIO(resp.content))

stops = pd.read_csv(z.open("stops.txt"), low_memory=False)
stop_times = pd.read_csv(z.open("stop_times.txt"), low_memory=False)
trips = pd.read_csv(z.open("trips.txt"), low_memory=False)
calendar = pd.read_csv(z.open("calendar.txt"), low_memory=False)
calendar_dates = pd.read_csv(z.open("calendar_dates.txt"), low_memory=False) if "calendar_dates.txt" in z.namelist() else pd.DataFrame()

result = {}

for target in TARGETS:
    nom = target["nom"]
    parent_station = target["parent_station"]
    route_id = target["route_id"]
    ligne = target["ligne"]

    stop_ids = stops[stops["parent_station"] == parent_station]["stop_id"].astype(str).tolist()
    if parent_station in stops["stop_id"].astype(str).values:
        stop_ids.append(parent_station)
    stop_ids = list(dict.fromkeys(stop_ids))

    trips_line = trips[trips["route_id"].astype(str) == route_id].copy()

    result.setdefault(nom, {}).setdefault(ligne, {})

    for day in days:
        day_str = day.strftime("%Y-%m-%d")
        weekday_col = WEEKDAY_COLUMNS[day.weekday()]
        active_service_ids = []

        for _, row in calendar.iterrows():
            start = datetime.strptime(str(int(row["start_date"])), "%Y%m%d").date()
            end = datetime.strptime(str(int(row["end_date"])), "%Y%m%d").date()
            if start <= day <= end and int(row.get(weekday_col, 0)) == 1:
                active_service_ids.append(row["service_id"])

        if not calendar_dates.empty:
            day_num = int(day.strftime("%Y%m%d"))
            exceptions = calendar_dates[calendar_dates["date"] == day_num]
            for _, ex in exceptions.iterrows():
                sid = ex["service_id"]
                if int(ex["exception_type"]) == 1 and sid not in active_service_ids:
                    active_service_ids.append(sid)
                elif int(ex["exception_type"]) == 2 and sid in active_service_ids:
                    active_service_ids.remove(sid)

        trips_today = trips_line[trips_line["service_id"].isin(active_service_ids)].copy()
        trip_ids_today = set(trips_today["trip_id"].astype(str))
        horaires_today = []

        if trip_ids_today:
            day_stop_times = stop_times[stop_times["trip_id"].astype(str).isin(trip_ids_today)].copy()
            trip_lookup = trips_today.set_index(trips_today["trip_id"].astype(str))

            for trip_id in trip_ids_today:
                trip_rows = day_stop_times[day_stop_times["trip_id"].astype(str) == trip_id].sort_values("stop_sequence")
                stops_this_trip = trip_rows[trip_rows["stop_id"].astype(str).isin(stop_ids)]
                if stops_this_trip.empty:
                    continue

                trip_info = trip_lookup.loc[trip_id]
                dest = str(trip_info.get("trip_headsign", "?"))

                for _, st in stops_this_trip.iterrows():
                    time_str = str(st["departure_time"])[:5]
                    stop_seq = st["stop_sequence"]
                    remaining = trip_rows[trip_rows["stop_sequence"] > stop_seq]
                    stop_name_map = stops.set_index(stops["stop_id"].astype(str))["stop_name"].to_dict()
                    remaining_stops = [
                        str(stop_name_map.get(str(stop_id), stop_id))
                        for stop_id in remaining["stop_id"].tolist()
                    ]

                    horaires_today.append({
                        "time": time_str,
                        "destination": dest,
                        "remaining_stops": remaining_stops,
                    })

        horaires_today.sort(key=lambda x: tuple(int(p) for p in x["time"].split(":")))
        result[nom][ligne][day_str] = horaires_today

with open("static/horaires_export.json", "w", encoding="utf-8") as f:
    json.dump(result, f, indent=2, ensure_ascii=False)

print("✅ Horaires GTFS exportés dans static/horaires_export.json")
