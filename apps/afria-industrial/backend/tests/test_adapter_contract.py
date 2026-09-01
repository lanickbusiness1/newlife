from app.adapters.contracts import ReadOnlyAdapter
from app.adapters.mqtt import MqttReadAdapter
from app.adapters.opcua import OpcUaReadAdapter


def test_adapter_contract_has_no_actuation_members():
    names = set(ReadOnlyAdapter.__dict__)
    assert not {'write', 'set', 'command', 'actuate'} & names
    assert {'connect', 'health', 'discover_readable_points', 'read_batch', 'disconnect'} <= names


def test_optional_provider_boundaries_are_non_blocking():
    assert MqttReadAdapter().health()['status'] == 'PROVIDER_PENDING'
    assert OpcUaReadAdapter().health()['status'] == 'PROVIDER_PENDING'
