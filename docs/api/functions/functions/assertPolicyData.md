[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / assertPolicyData

# Function: assertPolicyData()

> **assertPolicyData**(`policy`, `what`): `asserts policy is PolicyData`

Checks a caller-supplied policy before it is signed into a manifest: a policy is
immutable once a database exists, so a malformed one must be refused up front.

## Parameters

### policy

`unknown`

The policy data to check.

### what

`string`

Which policy this is, for the error message.

## Returns

`asserts policy is PolicyData`

## Throws

Error - If the policy is not a well-formed v1 json-logic policy.
