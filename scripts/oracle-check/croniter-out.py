"""Ответы croniter на тот же набор случаев — выгружаются в JSON для сверки."""
import json
import os
from datetime import datetime
from croniter import croniter

HERE = os.path.dirname(os.path.abspath(__file__))
cases = json.load(open(os.path.join(HERE, "ours.json")))
out = []
for c in cases:
    b = datetime.strptime(c["base"], "%Y-%m-%dT%H:%M:%S")
    try:
        it = croniter(c["expr"], b)
        out.append({"runs": [it.get_next(datetime).strftime("%Y-%m-%d %H:%M") for _ in range(8)], "error": None})
    except Exception as e:
        out.append({"runs": None, "error": f"{type(e).__name__}: {e}"})
json.dump(out, open(os.path.join(HERE, "croniter-out.json"), "w"))
print("croniter cases:", len(out))
