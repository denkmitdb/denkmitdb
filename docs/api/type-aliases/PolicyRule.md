[**@denkmitdb/denkmitdb**](../README.md)

***

[@denkmitdb/denkmitdb](../globals.md) / PolicyRule

# Type Alias: PolicyRule

> **PolicyRule** = [`PolicyLiteral`](PolicyLiteral.md) \| readonly `PolicyRule`[] \| \{ readonly \[K in PolicyOperator\]?: PolicyRule \| readonly PolicyRule\[\] \}

A rule in DenkMit Logic 1: a literal, a list, or `{ operator: arguments }` with
exactly one operator, e.g. `{ "==": [{ "var": "entryCreator" }, { "var": "databaseCreator" }] }`.
