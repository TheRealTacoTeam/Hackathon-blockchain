function setStatus(message) {
  var status = document.getElementById("status");
  status.innerHTML = message;
}

var nullAddr = '0x0000000000000000000000000000000000000000'
var accounts = [];
var account;

// TODO hardcode ledger location
var ledger = Ledger.deployed();

function decodeDamageStruct(data) {
    var out = {};
    var structMap = [
        'name',
        'description',
        'repaired',
        'reporter',
        'timestampReport',
        'repairer',
        'timestampRepair'
    ];

    for (var i = 0; i < data.length; i++) {
        out[structMap[i]] = data[i];
    }

    out['timestampReport'] = new Date(out['timestampReport'].c[0] * 1000);
    out['timestampRepair'] = new Date(out['timestampRepair'].c[0] * 1000);
    return out;
}


$('#storeCar').click(function() {
    var license = $('#inputLicense')[0].value;
    Car.new(
        license, $('#inputDescription')[0].value, {from: account}
    ).then(function(car) {
        console.log('Adding ' + license + ' @ ' + car.address);
        ledger.addCar(car.address, license, {from: account});

        alert('Auto toegevoegd ' + license);
        $('#inputDescription').val('');
        $('#inputLicense').val('');
    });
});

$('#storeReport').click(function() {
    var license = $('#inputLicenseReport').val();
    var name = $('#inputNameReport').val();
    var description = $('#inputDescriptionReport').val();

    ledger.findByLicense(license, {from: account}).then(function(addr) {
        if (addr == nullAddr) {
            alert('Kon het kenteken niet vinden: ' + license);
            return;
        }

        Car.at(addr).addDamage(name, description, {from: account});

        alert('Schaderapportage toegevoegd voor ' + license);
        $('#inputNameReport').val('');
        $('#inputDescriptionReport').val('');
    });
});

var currentLicense;
$("#searchLicenseButton").click(function() {
    updateList($('#inputLicenseList')[0].value);
});

function repairDamage(addr, index) {
    Car.at(addr).repairDamage(index, {from: account});
    updateList(currentLicense);
}

function updateList(license) {
    ledger.findByLicense(license, {from: account}).then(function(addr) {
        if(addr == nullAddr) {
            alert('Kon het kenteken niet vinden: ' + license);
            return;
        }

        var car = Car.at(addr);
        car.description().then(function(d) {
            $('#currentCarName').text(d);
        });

        car.damageCount.call().then(function (num) {
            num = num.toNumber();

            data = [];

            function buildList() {
                var table = $('tbody');
                table.html('');

                for(var i = 0; i < num; i++) {
                    data[i] = decodeDamageStruct(data[i]);

                    var repairBtn = 'repairDamage("'+addr+'",'+i+')';
                    table.append($('<tr>').append(
                        $('<td>').text(data[i].name),
                        $('<td>').text(data[i].description),
                        $('<td>').text(data[i].repaired ? 'Ja' : 'Nee'),
                        $('<td>').text(data[i].reporter),
                        $('<td>').text(data[i].timestampReport),
                        $('<td>').text(!data[i].repaired ? '' : data[i].repairer),
                        $('<td>').text(!data[i].repaired ? '' : data[i].timestampRepair),
                        $('<td>').append(
                            data[i].repaired ?
                                $('<span>') :
                                $('<button>').text('Repareer').attr('onclick', repairBtn)
                        )
                    ));
                }

                currentLicense = license;
                console.log(data);
            }

            function parseItem(zz) {
                return function(d) {
                    data[zz] = d;

                    if(data.length == num) {
                        for(var i = 0; i < num; i++) {
                            if(data[i] === undefined)
                                return;
                        }

                        buildList();
                    }
                }
            }

            for(var i = 0; i < num; i++) {
                car.damages(i).then(parseItem(i));
            }

        })
    });
}


window.onload = function() {
    web3.eth.getAccounts(function(err, accs) {
        if (err != null) {
            alert("There was an error fetching your accounts.");
            return;
        }

        if (accs.length == 0) {
            alert("Couldn't get any accounts! Make sure your Ethereum client is configured correctly.");
            return;
        }

        accounts = accs;

        var list = $('#addresslist');
        list.html('');
        for(var i = 0; i < accounts.length; i++) {
            list.append($('<option/>').val(accounts[i]).text(accounts[i]));
        }

        account = accounts[0];
        list.change(function() {
            account = $('#addresslist').val();
        });

        //list.children.attr('selected', true);
    });
};