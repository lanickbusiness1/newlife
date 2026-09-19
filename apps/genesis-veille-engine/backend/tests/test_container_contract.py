from pathlib import Path


DOCKERFILE = Path(__file__).resolve().parents[2] / "Dockerfile"


def test_runtime_container_declares_non_root_user():
    content = DOCKERFILE.read_text(encoding="utf-8")
    user_lines = [line.strip() for line in content.splitlines() if line.strip().startswith("USER ")]

    assert user_lines, "runtime image must declare an explicit non-root USER"
    declared = user_lines[-1].split(maxsplit=1)[1].strip().lower()
    assert declared not in {"root", "0", "0:0"}


def test_persistent_data_directory_is_owned_before_non_root_switch():
    content = DOCKERFILE.read_text(encoding="utf-8")

    assert "chown" in content.lower()
    assert "/data" in content
    assert content.index("chown") < content.index("USER ")
