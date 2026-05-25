import importlib
import sys


def test_cookies_path_uses_data_dir(monkeypatch, tmp_path):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    import scraper
    importlib.reload(scraper)
    assert scraper.COOKIES_PATH == tmp_path / "cookies.json"
    monkeypatch.delenv("DATA_DIR")
    importlib.reload(scraper)  # restore original state


def test_users_path_uses_data_dir(monkeypatch, tmp_path, patched_modules):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    sys.modules.pop("main", None)
    import main
    assert main.USERS_PATH == tmp_path / "users.json"


def test_cors_allows_configured_origin(monkeypatch, patched_modules):
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://myapp.pages.dev,http://localhost:5173")
    sys.modules.pop("main", None)
    import main
    from fastapi.testclient import TestClient
    client = TestClient(main.app)
    resp = client.get("/api/users", headers={"Origin": "https://myapp.pages.dev"})
    assert resp.headers.get("access-control-allow-origin") == "https://myapp.pages.dev"
