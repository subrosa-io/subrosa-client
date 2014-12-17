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
	
	this.decryptComm = function(comm, key){
		try {
			var cipher = forge.cipher.createDecipher('AES-GCM', key);
			if(comm.auxdata.length == 16){
				cipher.start({iv: comm.auxdata}); // v0.23 and earlier had no auth tag
			} else {
				var iv = comm.auxdata.substr(0, 16);
				var tag = comm.auxdata.substr(16, 16);
				cipher.start({iv: iv, tagLength: 128, tag: tag});
			}
			cipher.update(forge.util.createBuffer(comm.data));
			if(!cipher.finish()){
				// auth tag failed
				return {failedDecrypt: true, msg: "Auth tag doesn't match. This message was corrupted or tampered with."};
			}
		} catch (error) {
			console.error("Failed to decrypt message in " + target, comm, error);
			return {failedDecrypt: true, msg: "Failed to decrypt message."};
		}
		
		var decryptedData;
		try {
			var decryptedData = forge.util.decodeUtf8(cipher.output.bytes()); // .getBytes() to empty buffer
		} catch (error) {
			var decryptedData = cipher.output.data;
		}
		
		var decryptedObject;
		try {
			decryptedObject = JSON.parse(decryptedData);
			// verify timestamp (counter replay attacks)
			var fullTimestamp = 1400000000000 + decryptedObject.t * (60 * 60 * 1000);
			if(Math.abs(fullTimestamp - comm.time) < 25 * 60 * 60 * 1000){
				// timestamp OK (generous 25 - 26 hour grace period)
			} else {
				return {failedDecrypt: true, msg: "The sender's time is incorrect."};
			}
		} catch (e) {
			console.log(e, decryptedData);
			return {failedDecrypt: true, msg: "Failed to parse message object."};
		}
		
		return decryptedObject;
	}
	
}).call(window.SubrosaCrypto = {});
