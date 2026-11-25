#!/usr/bin/env python3
"""R8.4 pilot calculation. Cannot authenticate humans or independent evidence.
Synthetic input is never eligible for even a promising human-pilot result."""
import json, sys, statistics
CANDIDATE="4c6c0cdc55b1f7fcbd7aa3e319110d1cc528a44a"
ARMS=("browser","luch")
PLAN=[("browser","A","luch","B"),("luch","A","browser","B"),("browser","B","luch","A"),("luch","B","browser","A")]
def isbool(x): return type(x) is bool
def grade_arm(a):
    if not isinstance(a,dict): raise ValueError("arm required")
    if a.get("status") not in ("completed","abandoned","incomplete"): raise ValueError("invalid arm status")
    t=a.get("seconds")
    if type(t) not in (int,float) or not 0<=t<=720: raise ValueError("seconds must be within 0..720")
    if not isbool(a.get("critical")) or not isbool(a.get("help")): raise ValueError("binary flags required")
    cases=a.get("cases")
    if not isinstance(cases,list) or len(cases)!=2: raise ValueError("two case records required")
    successes=[]
    for c in cases:
        for field,n in (("decision",3),("handoff",4)):
            v=c.get(field)
            if not isinstance(v,list) or len(v)!=n or not all(isbool(x) for x in v): raise ValueError("invalid rubric")
        successes.append(all(c["decision"]+c["handoff"]))
    return a["status"]=="completed" and not a["critical"] and not a["help"] and all(successes)
def score(d):
    if d.get("candidate")!=CANDIDATE: raise ValueError("wrong product SHA")
    if d.get("mode") not in ("synthetic_dry_run","observer_claimed_human"): raise ValueError("explicit mode required")
    rows=d.get("participants",[])
    if not isinstance(rows,list) or len(rows)>12: raise ValueError("maximum 12 assigned rows")
    ids=set(); full={k:0 for k in ARMS}; time={k:[] for k in ARMS}
    wins=losses=critical=preferred=complete=0
    for p in rows:
        token=p.get("token")
        if token not in [f"P{i:02}" for i in range(1,13)] or token in ids: raise ValueError("invalid/duplicate participant token")
        ids.add(token)
        cell=(int(token[1:])-1)%4
        if p.get("cell")!=cell: raise ValueError("counterbalance mismatch")
        if p.get("status") in ("missing","withdrawn"):
            if p.get("arms") or p.get("preference"): raise ValueError("no data for missing/withdrawn")
            continue
        if p.get("status")!="observed" or p.get("consent_retained") is not True: raise ValueError("consented observed row required")
        if not isinstance(p.get("evidence_ref"),str) or not p["evidence_ref"].strip(): raise ValueError("private evidence reference required")
        a=p.get("arms",{})
        if set(a)!=set(ARMS): raise ValueError("both arms required")
        for index,arm in enumerate(PLAN[cell][::2]):
            if a[arm].get("set")!=PLAN[cell][2*index+1] or a[arm].get("order")!=index+1: raise ValueError("arm order/set mismatch")
        outcome={k:grade_arm(a[k]) for k in ARMS}
        if all(a[k]["status"]=="completed" for k in ARMS): complete+=1
        for k in ARMS:
            full[k]+=outcome[k];time[k].append(a[k]["seconds"])
        wins+=outcome["luch"] and not outcome["browser"]
        losses+=outcome["browser"] and not outcome["luch"]
        critical+=a["luch"]["critical"]
        if p.get("preference") not in ("luch","browser","neither","not_answered"): raise ValueError("invalid preference")
        preferred+=p["preference"]=="luch"
    med={k:statistics.median(time[k]) if time[k] else None for k in ARMS}
    metrics={"assigned":len(rows),"both_completed":complete,"full":full,"paired_wins":wins,"paired_losses":losses,"net":wins-losses,"luch_critical":critical,"luch_preferred":preferred,"median_seconds":med}
    ready=len(rows)==12 and complete==12
    tests={"complete_cohort":ready,"luch_full_at_least_9":full["luch"]>=9,"net_at_least_3":wins-losses>=3,"no_luch_critical":bool(time["luch"]) and critical==0,"preference_at_least_8":preferred>=8,"time_ratio_at_most_1_25":med["browser"] is not None and med["browser"]>0 and med["luch"]<=1.25*med["browser"]}
    approval=d.get("observer_protocol_approval_ref")
    if d["mode"]=="synthetic_dry_run": disposition="SYNTHETIC_ONLY"
    elif not isinstance(approval,str) or not approval.strip() or not ready: disposition="INCONCLUSIVE"
    else: disposition="PROMISING_PILOT_CLAIM_PENDING_EXTERNAL_VERIFICATION" if all(tests.values()) else "REWORK_CLAIM_PENDING_EXTERNAL_VERIFICATION"
    return {"candidate":CANDIDATE,"mode":d["mode"],"metrics":metrics,"thresholds":tests,"disposition":disposition,"human_identity_verified_by_script":False,"independent_approval_verified_by_script":False,"product_ready":False}
if __name__=="__main__":
    try: print(json.dumps(score(json.load(sys.stdin)),ensure_ascii=False,indent=2))
    except (ValueError,TypeError,KeyError,AttributeError) as e:
        print(json.dumps({"error":str(e),"product_ready":False}));sys.exit(1)
