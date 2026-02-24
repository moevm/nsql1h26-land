import os
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId

app = Flask(__name__)
CORS(app)

client = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017/"))
db = client["hello_db"]
collection = db["users"]

logs = []

def add_log(operation, detail):
    entry = {
        "time": datetime.utcnow().strftime("%H:%M:%S.%f")[:-3],
        "op": operation,
        "detail": detail,
    }
    logs.append(entry)
    if len(logs) > 50:
        logs.pop(0)


def serialize(doc):
    doc["_id"] = str(doc["_id"])
    return doc


@app.route("/api/users", methods=["GET"])
def get_users():
    users = [serialize(u) for u in collection.find()]
    add_log("FIND", f"db.users.find() -> {len(users)} doc(s)")
    return jsonify(users)


@app.route("/api/users", methods=["POST"])
def create_user():
    data = request.json
    result = collection.insert_one(data)
    data["_id"] = str(result.inserted_id)
    add_log("INSERT", f"db.users.insertOne({{name: \"{data['name']}\", age: {data['age']}, city: \"{data['city']}\"}}) -> _id: {data['_id']}")
    return jsonify(data), 201


@app.route("/api/users/<uid>", methods=["PUT"])
def update_user(uid):
    data = request.json
    data.pop("_id", None)
    collection.update_one({"_id": ObjectId(uid)}, {"$set": data})
    updated = serialize(collection.find_one({"_id": ObjectId(uid)}))
    add_log("UPDATE", f"db.users.updateOne({{_id: ObjectId(\"{uid}\")}}, {{$set: {data}}}) -> ok")
    return jsonify(updated)


@app.route("/api/users/<uid>", methods=["DELETE"])
def delete_user(uid):
    collection.delete_one({"_id": ObjectId(uid)})
    add_log("DELETE", f"db.users.deleteOne({{_id: ObjectId(\"{uid}\")}}) -> ok")
    return jsonify({"deleted": uid})


@app.route("/api/logs", methods=["GET"])
def get_logs():
    return jsonify(logs)


@app.route("/api/dbinfo", methods=["GET"])
def get_dbinfo():
    server_info = client.server_info()
    stats = db.command("dbstats")
    return jsonify({
        "server": f"MongoDB {server_info.get('version', '?')}",
        "host": client.address[0] if client.address else "?",
        "port": client.address[1] if client.address else "?",
        "database": db.name,
        "collection": collection.name,
        "documents": collection.count_documents({}),
        "storageSize": stats.get("storageSize", 0),
        "indexes": stats.get("indexes", 0),
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
