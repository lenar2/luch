import unittest,copy
from score import score,CANDIDATE,PLAN
def dataset():
    rows=[]
    for i in range(12):
        plan=PLAN[i%4]; arms={}
        for j in (0,2):
            arm=plan[j];case={"decision":[True]*3,"handoff":[True]*4}
            arms[arm]={"set":plan[j+1],"order":j//2+1,"status":"completed","seconds":300,"critical":False,"help":False,"cases":[copy.deepcopy(case),copy.deepcopy(case)]}
        if i<4:arms["browser"]["cases"][0]["decision"][1]=False
        rows.append({"token":f"P{i+1:02}","cell":i%4,"status":"observed","consent_retained":True,"evidence_ref":"SYNTHETIC-DO-NOT-USE","preference":"luch","arms":arms})
    return {"candidate":CANDIDATE,"mode":"synthetic_dry_run","observer_protocol_approval_ref":"","participants":rows}
class Test(unittest.TestCase):
    def test_synthetic_never_human(self):
        r=score(dataset());self.assertTrue(all(r["thresholds"].values()));self.assertEqual(r["disposition"],"SYNTHETIC_ONLY");self.assertFalse(r["product_ready"])
    def test_empty(self):
        d=dataset();d["participants"]=[];self.assertEqual(score(d)["metrics"]["assigned"],0)
    def test_duplicate(self):
        d=dataset();d["participants"][1]["token"]="P01";self.assertRaises(ValueError,score,d)
    def test_wrong_order(self):
        d=dataset();d["participants"][0]["arms"]["browser"]["order"]=2;self.assertRaises(ValueError,score,d)
    def test_wrong_sha(self):
        d=dataset();d["candidate"]="wrong";self.assertRaises(ValueError,score,d)
    def test_split_success(self):
        d=dataset();a=d["participants"][0]["arms"]["luch"];a["cases"][0]["handoff"][0]=False;self.assertEqual(score(d)["metrics"]["full"]["luch"],11)
    def test_missing(self):
        d=dataset();d["participants"][0]={"token":"P01","cell":0,"status":"withdrawn"};self.assertFalse(score(d)["thresholds"]["complete_cohort"])
    def test_critical(self):
        d=dataset();d["participants"][0]["arms"]["luch"]["critical"]=True;self.assertFalse(score(d)["thresholds"]["no_luch_critical"])
    def test_missing_approval(self):
        d=dataset();d["mode"]="observer_claimed_human";self.assertEqual(score(d)["disposition"],"INCONCLUSIVE")
    def test_claim_not_ready(self):
        d=dataset();d["mode"]="observer_claimed_human";d["observer_protocol_approval_ref"]="SYNTHETIC";r=score(d);self.assertFalse(r["product_ready"]);self.assertFalse(r["human_identity_verified_by_script"])
if __name__=="__main__":unittest.main()
