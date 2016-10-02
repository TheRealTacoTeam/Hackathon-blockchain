import "Car.sol";
import "owned.sol";

contract Ledger is owned {
    mapping (string => address) licenseLedger;
    mapping (address => string) public mechanics;

    function addCar(address _address, string licensePlate) {
        licenseLedger[licensePlate] = _address;
    }

    function findByLicense(string licensePlate) constant returns(address) {
        return licenseLedger[licensePlate];
    }

    function addMechanic(string name, address _address) onlyOwner {
        mechanics[_address] = name;
    }
}