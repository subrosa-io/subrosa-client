(function(){
	var Scrypt = scrypt_module_factory(); 
	
	this.createDerivedKey = function(password){
		var kdf = "sc1"; // Scrypt
		var salt = forge.random.getBytesSync(32);
		
		var uint8Key = Scrypt.crypto_scrypt(Scrypt.encode_utf8(password), Scrypt.encode_utf8(salt), 8192, 8, 1, 32);
		var derivedKey = Scrypt.decode_latin1(uint8Key);
		var derivedKeyHash = forge.sha256.create().update(derivedKey).digest().toHex();
		
		return {derivedKey: derivedKey, derivedKeyHash: derivedKeyHash, salt: salt, kdf: kdf};
	}
	this.getDerivedKey = function(password, salt, kdf){
		if(kdf == "sc1"){
			var uint8Key = Scrypt.crypto_scrypt(Scrypt.encode_utf8(password), Scrypt.encode_utf8(salt), 8192, 8, 1, 32);
			var derivedKey = Scrypt.decode_latin1(uint8Key);
			var derivedKeyHash = forge.sha256.create().update(derivedKey).digest().toHex();
			
			return {derivedKey: derivedKey, derivedKeyHash: derivedKeyHash, salt: salt, kdf: kdf};
		} else if(kdf == "pb1"){
			var derivedKey = forge.pbkdf2(password, salt, 10000, 32);
			var derivedKeyHash = forge.sha256.create().update(derivedKey).digest().toHex();
			
			return {derivedKey: derivedKey, derivedKeyHash: derivedKeyHash, salt: salt, kdf: kdf};
		} else {
			throw new Error("KDF " + kdf + " is unsupported.");
		}
	}
	
	this.generateRSAKeypair = function(generatingCallback, generatedCallback){
		var rsa = forge.pki.rsa;
		var state = rsa.createKeyPairGenerationState(2048, 0x65537);
		var step = function() {
			if(!rsa.stepKeyPairGenerationState(state, 100)) {
				generatingCallback();
				setTimeout(step, 1);
			} else {
				state.keys.publicKeyPem = forge.pki.publicKeyToPem(state.keys.publicKey);
				state.keys.privateKeyPem = forge.pki.privateKeyToPem(state.keys.privateKey);
				generatedCallback(state.keys);
			}
		};
		setTimeout(step);
	}
}).call(window.SubrosaCrypto = {});
