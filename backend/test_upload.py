import requests

# login
res = requests.post("http://localhost:8082/api/login", json={
    "email": "rendy@smk.baktinusantara666.sch.id",
    "password": "Rendy123"
})
token = res.json()["token"]

# create doc
res = requests.post("http://localhost:8082/api/drive/doc/create", json={
    "name": "tester456.docx",
    "type": "docx"
}, headers={"Authorization": "Bearer " + token})
doc_id = res.json()["id"]

print("Created doc ID:", doc_id)

# fetch doc
res = requests.get(f"http://localhost:8082/api/raw/doc/{doc_id}/tester456.docx")
with open("test_output.docx", "wb") as f:
    f.write(res.content)

print("Downloaded length:", len(res.content))
