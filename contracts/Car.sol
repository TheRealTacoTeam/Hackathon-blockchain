contract owned {
    address public owner;

    function owned() {
        owner = msg.sender;
    }

    modifier onlyOwner {
        if (msg.sender != owner) throw;
        _
    }

    modifier notOwner {
        if (msg.sender == owner) throw;
        _
    }
}

// Adding the image makes it break
contract Car is owned {
    string public licensePlate;
    string public description;

    Damage[] public damages;
    
    event DamageAdded(uint damageId, string name, string description);
    event DamageRepaired(uint damageId, string name);

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

        DamageAdded(damageId, name, description);
    }

    function repairDamage(uint damageId) {
        damages[damageId].repaired = true;
        damages[damageId].repairer = msg.sender;
        damages[damageId].timestampRepair = now;

        DamageRepaired(damageId, damages[damageId].name);
    }

    function damageCount() constant returns (uint) {
        return damages.length;
    }
}
