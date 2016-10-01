import "Car.sol";

contract Ledger {
    mapping (address => address) carLedger;
    mapping (string => address) licenseLedger;

    function addCar(address _address, string licensePlate) {
        carLedger[msg.sender] = _address;
        licenseLedger[licensePlate] = msg.sender;
    }

    function findByLicense(string licensePlate) returns(address) {
        return findByOwnerAddress(licenseLedger[licensePlate]);
    }

    function findByOwnerAddress(address _address) returns(address) {
        return carLedger[_address];
    }
}