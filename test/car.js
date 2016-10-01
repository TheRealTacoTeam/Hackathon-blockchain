contract('Car', function(accounts) {
    it('should be able to add damage', function() {
        Car.new('4SSB00B', {from: accounts[0]}).then(function(car) {
            car.addDamage.call(
                'Bestuurders deur', 
                'Twee deuken voor links op de deur met ieder een diepte van 1 cm', 
                {from: accounts[1]}
            );
        });
    });

    it('should be able to add damage with image', function() {
        Car.new('4SSB00B', {from: accounts[0]}).then(function(car) {
            car.addDamage.call(
                'Bestuurders deur', 
                'Twee deuken voor links op de deur met ieder een diepte van 1 cm', 
                [1,2,3,4], 
                {from: accounts[1]}
            );
        });
    });

    it('should have the correct license plate', function() {
        var car = Car.new('4SSB00B', {from: accounts[0]});
        return car.licensePlate().then(function(licensePlate) {
            assert.equal(licensePlate, '4SSB00B');    
        });
    });

    it('should be able to have damage repaired', function() {
        Car.new('4SSB00B', {from: accounts[0]}, function(car) {            
            car.repairDamage.call(0, {from: accounts[1]});
            assert.isTrue(car.damages(0)[2]);
        });
    });
});