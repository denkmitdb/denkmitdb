[**@denkmitdb/denkmitdb**](README.md)

***

# @denkmitdb/denkmitdb

DenkMitDB: a signed, peer-to-peer replicated key-value database on Helia.

This is the whole public API. Everything else in the package is internal and
may change in any release.

## Classes

- [DenkmitError](classes/DenkmitError.md)

## Interfaces

- [Database](interfaces/Database.md)
- [Identity](interfaces/Identity.md)
- [SigningIdentity](interfaces/SigningIdentity.md)
- [ValueCache](interfaces/ValueCache.md)

## Type Aliases

- [AccessRule](type-aliases/AccessRule.md)
- [Consensus](type-aliases/Consensus.md)
- [CreateDatabaseOptions](type-aliases/CreateDatabaseOptions.md)
- [DatabaseOptions](type-aliases/DatabaseOptions.md)
- [EncryptedValue](type-aliases/EncryptedValue.md)
- [EncryptionContext](type-aliases/EncryptionContext.md)
- [ErrorCode](type-aliases/ErrorCode.md)
- [HeliaNode](type-aliases/HeliaNode.md)
- [IdentityAlgorithm](type-aliases/IdentityAlgorithm.md)
- [Manifest](type-aliases/Manifest.md)
- [NodeLibp2p](type-aliases/NodeLibp2p.md)
- [PolicyDefinition](type-aliases/PolicyDefinition.md)
- [Provenance](type-aliases/Provenance.md)
- [SignedPolicy](type-aliases/SignedPolicy.md)
- [WriteOptions](type-aliases/WriteOptions.md)

## Functions

- [createDatabase](functions/createDatabase.md)
- [createIdentity](functions/createIdentity.md)
- [decryptValue](functions/decryptValue.md)
- [encryptedValueRecipients](functions/encryptedValueRecipients.md)
- [encryptValueFor](functions/encryptValueFor.md)
- [fetchIdentity](functions/fetchIdentity.md)
- [hasIdentity](functions/hasIdentity.md)
- [isDenkmitError](functions/isDenkmitError.md)
- [isEncryptedValue](functions/isEncryptedValue.md)
- [openDatabase](functions/openDatabase.md)
- [openIdentity](functions/openIdentity.md)
