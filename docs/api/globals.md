[**@denkmitdb/denkmitdb**](README.md)

***

# @denkmitdb/denkmitdb

DenkMitDB: a signed, peer-to-peer replicated key-value database on Helia.

This is the whole public API. Everything else in the package is internal and
may change in any release.

## Interfaces

- [Database](interfaces/Database.md)
- [Identity](interfaces/Identity.md)
- [SigningIdentity](interfaces/SigningIdentity.md)

## Type Aliases

- [AccessPreset](type-aliases/AccessPreset.md)
- [CreateDatabaseOptions](type-aliases/CreateDatabaseOptions.md)
- [DatabaseOptions](type-aliases/DatabaseOptions.md)
- [EncryptedValue](type-aliases/EncryptedValue.md)
- [EncryptionContext](type-aliases/EncryptionContext.md)
- [HeliaNode](type-aliases/HeliaNode.md)
- [IdentityAlgorithm](type-aliases/IdentityAlgorithm.md)
- [Manifest](type-aliases/Manifest.md)
- [NodeLibp2p](type-aliases/NodeLibp2p.md)
- [Policy](type-aliases/Policy.md)
- [PolicyDefinition](type-aliases/PolicyDefinition.md)
- [Provenance](type-aliases/Provenance.md)
- [WriteOptions](type-aliases/WriteOptions.md)

## Functions

- [createDatabase](functions/createDatabase.md)
- [createIdentity](functions/createIdentity.md)
- [decryptValue](functions/decryptValue.md)
- [encryptedRecipients](functions/encryptedRecipients.md)
- [encryptValueFor](functions/encryptValueFor.md)
- [fetchIdentity](functions/fetchIdentity.md)
- [hasIdentity](functions/hasIdentity.md)
- [isEncryptedValue](functions/isEncryptedValue.md)
- [openDatabase](functions/openDatabase.md)
- [openIdentity](functions/openIdentity.md)
