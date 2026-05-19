import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path, monkeypatch, patched_modules):
    import main
    monkeypatch.setattr(main, "USERS_PATH", tmp_path / "users.json")
    from fastapi.testclient import TestClient
    return TestClient(main.app)


def test_get_users_returns_empty_list(client):
    response = client.get("/api/users")
    assert response.status_code == 200
    assert response.json() == []


def test_add_user(client):
    response = client.post("/api/users", json={"username": "elonmusk"})
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_add_duplicate_user_returns_400(client):
    client.post("/api/users", json={"username": "elonmusk"})
    response = client.post("/api/users", json={"username": "elonmusk"})
    assert response.status_code == 400


def test_delete_user(client):
    client.post("/api/users", json={"username": "elonmusk"})
    response = client.delete("/api/users/elonmusk")
    assert response.status_code == 200
    users = client.get("/api/users").json()
    assert users == []


def test_get_users_returns_added_users(client):
    client.post("/api/users", json={"username": "sama", "note": "OpenAI CEO"})
    users = client.get("/api/users").json()
    assert len(users) == 1
    assert users[0]["username"] == "sama"
    assert users[0]["note"] == "OpenAI CEO"
