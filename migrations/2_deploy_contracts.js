module.exports = function(deployer) {
  deployer.deploy(owned);
  deployer.autolink();
  deployer.deploy(Car);
  deployer.autolink();
  deployer.deploy(Ledger);
};
