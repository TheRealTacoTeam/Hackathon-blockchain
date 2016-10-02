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