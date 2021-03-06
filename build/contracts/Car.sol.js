var Web3 = require("web3");
var SolidityEvent = require("web3/lib/web3/event.js");

(function() {
  // Planned for future features, logging, etc.
  function Provider(provider) {
    this.provider = provider;
  }

  Provider.prototype.send = function() {
    this.provider.send.apply(this.provider, arguments);
  };

  Provider.prototype.sendAsync = function() {
    this.provider.sendAsync.apply(this.provider, arguments);
  };

  var BigNumber = (new Web3()).toBigNumber(0).constructor;

  var Utils = {
    is_object: function(val) {
      return typeof val == "object" && !Array.isArray(val);
    },
    is_big_number: function(val) {
      if (typeof val != "object") return false;

      // Instanceof won't work because we have multiple versions of Web3.
      try {
        new BigNumber(val);
        return true;
      } catch (e) {
        return false;
      }
    },
    merge: function() {
      var merged = {};
      var args = Array.prototype.slice.call(arguments);

      for (var i = 0; i < args.length; i++) {
        var object = args[i];
        var keys = Object.keys(object);
        for (var j = 0; j < keys.length; j++) {
          var key = keys[j];
          var value = object[key];
          merged[key] = value;
        }
      }

      return merged;
    },
    promisifyFunction: function(fn, C) {
      var self = this;
      return function() {
        var instance = this;

        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {
          var callback = function(error, result) {
            if (error != null) {
              reject(error);
            } else {
              accept(result);
            }
          };
          args.push(tx_params, callback);
          fn.apply(instance.contract, args);
        });
      };
    },
    synchronizeFunction: function(fn, instance, C) {
      var self = this;
      return function() {
        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {

          var decodeLogs = function(logs) {
            return logs.map(function(log) {
              var logABI = C.events[log.topics[0]];

              if (logABI == null) {
                return null;
              }

              var decoder = new SolidityEvent(null, logABI, instance.address);
              return decoder.decode(log);
            }).filter(function(log) {
              return log != null;
            });
          };

          var callback = function(error, tx) {
            if (error != null) {
              reject(error);
              return;
            }

            var timeout = C.synchronization_timeout || 240000;
            var start = new Date().getTime();

            var make_attempt = function() {
              C.web3.eth.getTransactionReceipt(tx, function(err, receipt) {
                if (err) return reject(err);

                if (receipt != null) {
                  // If they've opted into next gen, return more information.
                  if (C.next_gen == true) {
                    return accept({
                      tx: tx,
                      receipt: receipt,
                      logs: decodeLogs(receipt.logs)
                    });
                  } else {
                    return accept(tx);
                  }
                }

                if (timeout > 0 && new Date().getTime() - start > timeout) {
                  return reject(new Error("Transaction " + tx + " wasn't processed in " + (timeout / 1000) + " seconds!"));
                }

                setTimeout(make_attempt, 1000);
              });
            };

            make_attempt();
          };

          args.push(tx_params, callback);
          fn.apply(self, args);
        });
      };
    }
  };

  function instantiate(instance, contract) {
    instance.contract = contract;
    var constructor = instance.constructor;

    // Provision our functions.
    for (var i = 0; i < instance.abi.length; i++) {
      var item = instance.abi[i];
      if (item.type == "function") {
        if (item.constant == true) {
          instance[item.name] = Utils.promisifyFunction(contract[item.name], constructor);
        } else {
          instance[item.name] = Utils.synchronizeFunction(contract[item.name], instance, constructor);
        }

        instance[item.name].call = Utils.promisifyFunction(contract[item.name].call, constructor);
        instance[item.name].sendTransaction = Utils.promisifyFunction(contract[item.name].sendTransaction, constructor);
        instance[item.name].request = contract[item.name].request;
        instance[item.name].estimateGas = Utils.promisifyFunction(contract[item.name].estimateGas, constructor);
      }

      if (item.type == "event") {
        instance[item.name] = contract[item.name];
      }
    }

    instance.allEvents = contract.allEvents;
    instance.address = contract.address;
    instance.transactionHash = contract.transactionHash;
  };

  // Use inheritance to create a clone of this contract,
  // and copy over contract's static functions.
  function mutate(fn) {
    var temp = function Clone() { return fn.apply(this, arguments); };

    Object.keys(fn).forEach(function(key) {
      temp[key] = fn[key];
    });

    temp.prototype = Object.create(fn.prototype);
    bootstrap(temp);
    return temp;
  };

  function bootstrap(fn) {
    fn.web3 = new Web3();
    fn.class_defaults  = fn.prototype.defaults || {};

    // Set the network iniitally to make default data available and re-use code.
    // Then remove the saved network id so the network will be auto-detected on first use.
    fn.setNetwork("default");
    fn.network_id = null;
    return fn;
  };

  // Accepts a contract object created with web3.eth.contract.
  // Optionally, if called without `new`, accepts a network_id and will
  // create a new version of the contract abstraction with that network_id set.
  function Contract() {
    if (this instanceof Contract) {
      instantiate(this, arguments[0]);
    } else {
      var C = mutate(Contract);
      var network_id = arguments.length > 0 ? arguments[0] : "default";
      C.setNetwork(network_id);
      return C;
    }
  };

  Contract.currentProvider = null;

  Contract.setProvider = function(provider) {
    var wrapped = new Provider(provider);
    this.web3.setProvider(wrapped);
    this.currentProvider = provider;
  };

  Contract.new = function() {
    if (this.currentProvider == null) {
      throw new Error("Car error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("Car error: contract binary not set. Can't deploy new instance.");
    }

    var regex = /__[^_]+_+/g;
    var unlinked_libraries = this.binary.match(regex);

    if (unlinked_libraries != null) {
      unlinked_libraries = unlinked_libraries.map(function(name) {
        // Remove underscores
        return name.replace(/_/g, "");
      }).sort().filter(function(name, index, arr) {
        // Remove duplicates
        if (index + 1 >= arr.length) {
          return true;
        }

        return name != arr[index + 1];
      }).join(", ");

      throw new Error("Car contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of Car: " + unlinked_libraries);
    }

    var self = this;

    return new Promise(function(accept, reject) {
      var contract_class = self.web3.eth.contract(self.abi);
      var tx_params = {};
      var last_arg = args[args.length - 1];

      // It's only tx_params if it's an object and not a BigNumber.
      if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
        tx_params = args.pop();
      }

      tx_params = Utils.merge(self.class_defaults, tx_params);

      if (tx_params.data == null) {
        tx_params.data = self.binary;
      }

      // web3 0.9.0 and above calls new twice this callback twice.
      // Why, I have no idea...
      var intermediary = function(err, web3_instance) {
        if (err != null) {
          reject(err);
          return;
        }

        if (err == null && web3_instance != null && web3_instance.address != null) {
          accept(new self(web3_instance));
        }
      };

      args.push(tx_params, intermediary);
      contract_class.new.apply(contract_class, args);
    });
  };

  Contract.at = function(address) {
    if (address == null || typeof address != "string" || address.length != 42) {
      throw new Error("Invalid address passed to Car.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: Car not deployed or address not set.");
    }

    return this.at(this.address);
  };

  Contract.defaults = function(class_defaults) {
    if (this.class_defaults == null) {
      this.class_defaults = {};
    }

    if (class_defaults == null) {
      class_defaults = {};
    }

    var self = this;
    Object.keys(class_defaults).forEach(function(key) {
      var value = class_defaults[key];
      self.class_defaults[key] = value;
    });

    return this.class_defaults;
  };

  Contract.extend = function() {
    var args = Array.prototype.slice.call(arguments);

    for (var i = 0; i < arguments.length; i++) {
      var object = arguments[i];
      var keys = Object.keys(object);
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        var value = object[key];
        this.prototype[key] = value;
      }
    }
  };

  Contract.all_networks = {
  "default": {
    "abi": [
      {
        "constant": false,
        "inputs": [
          {
            "name": "damageId",
            "type": "uint256"
          }
        ],
        "name": "repairDamage",
        "outputs": [],
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "description",
            "type": "string"
          }
        ],
        "name": "addDamage",
        "outputs": [],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "description",
        "outputs": [
          {
            "name": "",
            "type": "string"
          }
        ],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "licensePlate",
        "outputs": [
          {
            "name": "",
            "type": "string"
          }
        ],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "owner",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "damages",
        "outputs": [
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "repaired",
            "type": "bool"
          },
          {
            "name": "reporter",
            "type": "address"
          },
          {
            "name": "timestampReport",
            "type": "uint256"
          },
          {
            "name": "repairer",
            "type": "address"
          },
          {
            "name": "timestampRepair",
            "type": "uint256"
          }
        ],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "damageCount",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "type": "function"
      },
      {
        "inputs": [
          {
            "name": "_licensePlate",
            "type": "string"
          },
          {
            "name": "_description",
            "type": "string"
          }
        ],
        "type": "constructor"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "damageId",
            "type": "uint256"
          }
        ],
        "name": "DamageUpdated",
        "type": "event"
      }
    ],
    "unlinked_binary": "0x60606040526040516109bd3803806109bd833981016040528051608051908201910160008054600160a060020a031916331790558160016000509080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106100ac57805160ff19168380011785555b506100dc9291505b808211156101355760008155600101610086565b50505050610854806101696000396000f35b8280016001018555821561007e579182015b8281111561007e5782518260005055916020019190600101906100be565b50508060026000509080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061013957805160ff19168380011785555b5061009a929150610086565b5090565b82800160010185558215610129579182015b8281111561012957825182600050559160200191906001019061014b56606060405236156100615760e060020a60003504634d665cc0811461006357806365f2f0be146101645780637284e416146102225780637c7077a61461027d5780638da5cb5b146102da578063b1704a46146102ec578063b1c39a1114610348575b005b610061600435600160036000508281548110156100025760008290527fc2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85d6006820201805460ff191690931790925580543392508390811015610002577fc2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85f60068202018054600160a060020a031916909317909255805442925083908110156100025750507fc2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f8606006830201556040805182815290517f57f9b9e85d870b4f24ab94efb59decda1d829b04bb44762889d27d267a806f999181900360200190a150565b6040805160206004803580820135601f8101849004840285018401909552848452610061949193602493909291840191908190840183828082843750506040805160208835808b0135601f8101839004830284018301909452838352979998604498929750919091019450909250829150840183828082843750949650505050505050600060036000508054806001018281815481835581811511610521576006028160060283600052602060002091820191016105219190610608565b6040805160028054602060018216156101000260001901909116829004601f810182900482028401820190945283835261035d939083018282801561084c5780601f106108215761010080835404028352916020019161084c565b61035d60018054604080516020600284861615610100026000190190941693909304601f8101849004840282018401909252818152929183018282801561084c5780601f106108215761010080835404028352916020019161084c565b6103cb600054600160a060020a031681565b6103e86004356003805482908110156100025790600052602060002090600602016000506002810154600382015460048301546005840154939450600185019360ff8416936101009004600160a060020a039081169392169087565b60035460408051918252519081900360200190f35b60405180806020018281038252838181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f1680156103bd5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b60408051600160a060020a03929092168252519081900360200190f35b6040805186151591810191909152600160a060020a03858116606083015260808201859052831660a082015260c0810182905260e08082528854600260018216156101009081026000190190921604918301829052829160208301918301908b9080156104965780601f1061046b57610100808354040283529160200191610496565b820191906000526020600020905b81548152906001019060200180831161047957829003601f168201915b50508381038252895460026001821615610100026000190190911604808252602091909101908a90801561050b5780601f106104e05761010080835404028352916020019161050b565b820191906000526020600020905b8154815290600101906020018083116104ee57829003601f168201915b5050995050505050505050505060405180910390f35b505050919090600052602060002090600602016000506040805160e0810182528681526020818101879052600092820183905233606083015242608083015260a0820183905260c082018390528751845485855293829020929493849360026001831615610100026000190190921691909104601f9081018490048201938b01908390106106b757805160ff19168380011785555b506106e7929150610681565b505060028101805474ffffffffffffffffffffffffffffffffffffffffff19169055600060038201819055600482018054600160a060020a031916905560058201556006015b8082111561069557600060008201600050805460018160011615610100020316600290046000825580601f1061066757505b5060018201600050805460018160011615610100020316600290046000825580601f1061069957506105c2565b601f01602090049060005260206000209081019061063a91905b808211156106955760008155600101610681565b5090565b601f0160209004906000526020600020908101906105c29190610681565b828001600101855582156105b6579182015b828111156105b65782518260005055916020019190600101906106c9565b50506020820151816001016000509080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061074657805160ff19168380011785555b50610776929150610681565b8280016001018555821561073a579182015b8281111561073a578251826000505591602001919060010190610758565b505060408281015160028301805460608601516101000274ffffffffffffffffffffffffffffffffffffffff001960ff1992909216909317169190911790556080830151600383015560a0830151600483018054600160a060020a031916909117905560c0929092015160059190910155805182815290519192507f57f9b9e85d870b4f24ab94efb59decda1d829b04bb44762889d27d267a806f99919081900360200190a1505050565b820191906000526020600020905b81548152906001019060200180831161082f57829003601f168201915b50505050508156",
    "events": {
      "0x1d5bf0a4ca5cc8537272c9242030bff78a68c962097b31f7c30d29d47824745c": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "damageId",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "name",
            "type": "string"
          },
          {
            "indexed": false,
            "name": "description",
            "type": "string"
          }
        ],
        "name": "DamageAdded",
        "type": "event"
      },
      "0x0d1eb4691824e19558e33312b9830a3f5c6d81eb9d5d322a926d36803bdab3ed": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "damageId",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "name",
            "type": "string"
          }
        ],
        "name": "DamageRepaired",
        "type": "event"
      },
      "0x57f9b9e85d870b4f24ab94efb59decda1d829b04bb44762889d27d267a806f99": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "damageId",
            "type": "uint256"
          }
        ],
        "name": "DamageUpdated",
        "type": "event"
      }
    },
    "updated_at": 1475409405936,
    "links": {},
    "address": "0x66cf5b7620976aea57661da13c88488d461c214d"
  }
};

  Contract.checkNetwork = function(callback) {
    var self = this;

    if (this.network_id != null) {
      return callback();
    }

    this.web3.version.network(function(err, result) {
      if (err) return callback(err);

      var network_id = result.toString();

      // If we have the main network,
      if (network_id == "1") {
        var possible_ids = ["1", "live", "default"];

        for (var i = 0; i < possible_ids.length; i++) {
          var id = possible_ids[i];
          if (Contract.all_networks[id] != null) {
            network_id = id;
            break;
          }
        }
      }

      if (self.all_networks[network_id] == null) {
        return callback(new Error(self.name + " error: Can't find artifacts for network id '" + network_id + "'"));
      }

      self.setNetwork(network_id);
      callback();
    })
  };

  Contract.setNetwork = function(network_id) {
    var network = this.all_networks[network_id] || {};

    this.abi             = this.prototype.abi             = network.abi;
    this.unlinked_binary = this.prototype.unlinked_binary = network.unlinked_binary;
    this.address         = this.prototype.address         = network.address;
    this.updated_at      = this.prototype.updated_at      = network.updated_at;
    this.links           = this.prototype.links           = network.links || {};
    this.events          = this.prototype.events          = network.events || {};

    this.network_id = network_id;
  };

  Contract.networks = function() {
    return Object.keys(this.all_networks);
  };

  Contract.link = function(name, address) {
    if (typeof name == "function") {
      var contract = name;

      if (contract.address == null) {
        throw new Error("Cannot link contract without an address.");
      }

      Contract.link(contract.contract_name, contract.address);

      // Merge events so this contract knows about library's events
      Object.keys(contract.events).forEach(function(topic) {
        Contract.events[topic] = contract.events[topic];
      });

      return;
    }

    if (typeof name == "object") {
      var obj = name;
      Object.keys(obj).forEach(function(name) {
        var a = obj[name];
        Contract.link(name, a);
      });
      return;
    }

    Contract.links[name] = address;
  };

  Contract.contract_name   = Contract.prototype.contract_name   = "Car";
  Contract.generated_with  = Contract.prototype.generated_with  = "3.2.0";

  // Allow people to opt-in to breaking changes now.
  Contract.next_gen = false;

  var properties = {
    binary: function() {
      var binary = Contract.unlinked_binary;

      Object.keys(Contract.links).forEach(function(library_name) {
        var library_address = Contract.links[library_name];
        var regex = new RegExp("__" + library_name + "_*", "g");

        binary = binary.replace(regex, library_address.replace("0x", ""));
      });

      return binary;
    }
  };

  Object.keys(properties).forEach(function(key) {
    var getter = properties[key];

    var definition = {};
    definition.enumerable = true;
    definition.configurable = false;
    definition.get = getter;

    Object.defineProperty(Contract, key, definition);
    Object.defineProperty(Contract.prototype, key, definition);
  });

  bootstrap(Contract);

  if (typeof module != "undefined" && typeof module.exports != "undefined") {
    module.exports = Contract;
  } else {
    // There will only be one version of this contract in the browser,
    // and we can use that.
    window.Car = Contract;
  }
})();
