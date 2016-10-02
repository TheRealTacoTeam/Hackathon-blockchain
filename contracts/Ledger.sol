import "Car.sol";

contract Ledger {
    mapping (string => address) licenseLedger;

    function addCar(address _address, string licensePlate) {
        licenseLedger[licensePlate] = _address;
    }

    function findByLicense(string licensePlate) constant returns(address) {
        return licenseLedger[licensePlate];
    }
}