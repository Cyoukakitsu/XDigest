import importlib
import pytest


def test_cookies_path_uses_data_dir(monkeypatch, tmp_path):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    import scraper
    importlib.reload(scraper)
    assert scraper.COOKIES_PATH == tmp_path / "cookies.json"
