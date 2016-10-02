import "owned.sol";

// Adding the image makes it break
contract Car is owned {
    string public licensePlate;
    string public description;

    Damage[] public damages;
    
    event DamageUpdated(uint damageId);

    struct Damage {
        string name;
        string description;
        bool repaired;   
        address reporter;
        uint timestampReport;
        address repairer;
        uint timestampRepair;
    }

    function Car(string _licensePlate, string _description) {
        licensePlate = _licensePlate;
        description = _description;
    }

    function addDamage(string name, string description) {
        uint damageId = damages.push(Damage(
            name, description, false, msg.sender, now, 0, 0 
        ));

        DamageUpdated(damageId);
    }

    function repairDamage(uint damageId) {
        damages[damageId].repaired = true;
        damages[damageId].repairer = msg.sender;
        damages[damageId].timestampRepair = now;

        DamageUpdated(damageId);
    }

    function damageCount() constant returns (uint) {
        return damages.length;
    }
}
