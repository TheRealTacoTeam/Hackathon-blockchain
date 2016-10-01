function setStatus(message) {
  var status = document.getElementById("status");
  status.innerHTML = message;
};

var ledger = Ledger.deployed();

function decodeDamageStruct(data) {
    var out = {};
    var structMap = [
        'name'
        'description',
        'repaired',
        'reporter',
        'timestampReport',
        'repairer',
        'timestampRepair',
    ];

    for (var i = 0; i < data.length; i++) {
        out[structMap[i]] = data[i];
    }

    return out;
}