(function(){
	
	this.createDerivedKey = function(password, callback){
		var kdf = "sc1"; // Scrypt
		var salt = forge.random.getBytesSync(32);
		
		scrypt(password, salt, 13, 8, 32, 1000, function(a){
			var derivedKey = atob(a);
			var derivedKeyHash = forge.sha256.create().update(derivedKey).digest().toHex();
			
			callback({derivedKey: derivedKey, derivedKeyHash: derivedKeyHash, salt: salt, kdf: kdf});
			
		}, "base64");
	}
	this.getDerivedKey = function(password, salt, kdf, callback){
		if(kdf == "sc1"){
			//var uint8Key = Scrypt.crypto_scrypt(Scrypt.encode_utf8(password), Scrypt.encode_utf8(salt), 8192, 8, 1, 32);
			//var derivedKey = Scrypt.decode_latin1(uint8Key);
			
			scrypt(password, salt, 13, 8, 32, 1000, function(a){
				var derivedKey = atob(a);
				var derivedKeyHash = forge.sha256.create().update(derivedKey).digest().toHex();
				
				callback({derivedKey: derivedKey, derivedKeyHash: derivedKeyHash, salt: salt, kdf: kdf});
				
			}, "base64");
			
		} else if(kdf == "pb1"){
			var derivedKey = forge.pbkdf2(password, salt, 10000, 32);
			var derivedKeyHash = forge.sha256.create().update(derivedKey).digest().toHex();
			
			callback({derivedKey: derivedKey, derivedKeyHash: derivedKeyHash, salt: salt, kdf: kdf});
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
	
	this.processKeyExchange = function(encrypted, signature, otherPubKey, myPrivateKey){		
		try {
			var decrypted = myPrivateKey.decrypt(encrypted, 'RSA-OAEP');
			
			var md = forge.md.sha256.create();
			md.update(decrypted, 'utf8');
			
			otherPubKey = forge.pki.publicKeyFromPem(otherPubKey);
			var verified = otherPubKey.verify(md.digest().bytes(), signature);
			
			if(verified){
				var convKey = decrypted.substr(0,32);
				var convId = decrypted.substr(32);
				
				if(convId.length == 37){
					return convKey;
				}
			}
		} catch ( exception ) {
			throw exception;
		}
		return false;
	}
	
	this.getFingerprintHash = function(myPubKey, otherPartyPubKey, myUid, otherPartyUid){
				
		var keyCombined;
		if(otherPartyUid < appcore.uid){
			keyCombined = myPubKey + otherPartyPubKey;
		} else {
			keyCombined = otherPartyPubKey + myPubKey;
		}
		
		var md = forge.md.sha256.create();
		md.update(keyCombined);
		
		return md.digest().toHex();
	}
	
}).call(window.SubrosaCrypto = {});
