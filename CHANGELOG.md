# Changelog

## [3.0.0](https://github.com/HorizonRepublic/nominal-types/compare/v2.0.14...v3.0.0) (2026-10-08)


### ⚠ BREAKING CHANGES

* the 2.x API is gone: NType(), Type.getPipe() and constructors that checked nothing. A type is now a class made with Nominal() or a base type's subtype(), and new checks its value; see the README and docs.

### Features

* **adapters:** Drizzle and Sequelize adapters ([#72](https://github.com/HorizonRepublic/nominal-types/issues/72)) ([ab84e81](https://github.com/HorizonRepublic/nominal-types/commit/ab84e818fae003f149ef5fbf30edffcf4557bfb2))
* **adapters:** GraphQL scalars and superjson transformers ([#74](https://github.com/HorizonRepublic/nominal-types/issues/74)) ([5cb362c](https://github.com/HorizonRepublic/nominal-types/commit/5cb362c20a12c476b83e0f9297845be6d7524bdc))
* **adapters:** MikroORM and TypeORM adapters ([#70](https://github.com/HorizonRepublic/nominal-types/issues/70)) ([c2e0730](https://github.com/HorizonRepublic/nominal-types/commit/c2e0730ba13deadda35753bbd52d99f117bffa1d))
* **adapters:** Zod and Valibot adapters, adapter functions named to… / constrain… / from… ([#69](https://github.com/HorizonRepublic/nominal-types/issues/69)) ([8f3a520](https://github.com/HorizonRepublic/nominal-types/commit/8f3a520f57885953f10a137f39a80b8cb1185acf))
* **arktype:** native ArkType nodes for nominal types, with constraints ([#62](https://github.com/HorizonRepublic/nominal-types/issues/62)) ([293b095](https://github.com/HorizonRepublic/nominal-types/commit/293b0955e44df6ae9b2e02e11a12098ebf220dcc))
* **class-validator:** add NominalField for DTO properties ([#43](https://github.com/HorizonRepublic/nominal-types/issues/43)) ([f53acd5](https://github.com/HorizonRepublic/nominal-types/commit/f53acd586c64afb9ad51f76b912133edee139176))
* **class-validator:** choose what a property is written as with serialize ([#50](https://github.com/HorizonRepublic/nominal-types/issues/50)) ([290efe7](https://github.com/HorizonRepublic/nominal-types/commit/290efe7e3332929953a857832b3d0b04262fa952))
* **class-validator:** write nominal values back in instanceToPlain ([#49](https://github.com/HorizonRepublic/nominal-types/issues/49)) ([ffcaf61](https://github.com/HorizonRepublic/nominal-types/commit/ffcaf61cca06803ecde0cca588c76d87d0cc6283))
* **core:** add schemaOf() with arrays, optional and nullable values ([#41](https://github.com/HorizonRepublic/nominal-types/issues/41)) ([d0afe15](https://github.com/HorizonRepublic/nominal-types/commit/d0afe15bec14a720a16dd00802f3b70371268fc3))
* **core:** add variants and let every level add its own rule ([#31](https://github.com/HorizonRepublic/nominal-types/issues/31)) ([43dc520](https://github.com/HorizonRepublic/nominal-types/commit/43dc520d3dd19425d8d4e5382d736d678075d7c3))
* **core:** constraint() checks fields of an object against each other ([#61](https://github.com/HorizonRepublic/nominal-types/issues/61)) ([c4c24cc](https://github.com/HorizonRepublic/nominal-types/commit/c4c24cc38409fffbecfd1910da2b5d89ee9979f7))
* **core:** declare a type from a regular expression ([#28](https://github.com/HorizonRepublic/nominal-types/issues/28)) ([5b6783c](https://github.com/HorizonRepublic/nominal-types/commit/5b6783c0db628dcc1f6f5567ed63eeb51d6c0f63))
* **core:** declare nominal types from any Standard Schema ([#18](https://github.com/HorizonRepublic/nominal-types/issues/18)) ([a8a66d9](https://github.com/HorizonRepublic/nominal-types/commit/a8a66d9d0a629053c81cedbc701063509b320594))
* **core:** describe types with titles, formats, lengths and checked examples ([#44](https://github.com/HorizonRepublic/nominal-types/issues/44)) ([b01e1d0](https://github.com/HorizonRepublic/nominal-types/commit/b01e1d096c06727e29be693701f5987c2ef09eef))
* **core:** dotted type names, built-in types named under nominal. ([#67](https://github.com/HorizonRepublic/nominal-types/issues/67)) ([c95c17a](https://github.com/HorizonRepublic/nominal-types/commit/c95c17af446a65694ce6c79417160cab12a1d582))
* **core:** instances stand for their values, object values are frozen ([#60](https://github.com/HorizonRepublic/nominal-types/issues/60)) ([39442ee](https://github.com/HorizonRepublic/nominal-types/commit/39442ee40e8fb27168b9afe2820bb2ad8105b140))
* **core:** narrow an instance of a parent type in parse ([#26](https://github.com/HorizonRepublic/nominal-types/issues/26)) ([21c7c18](https://github.com/HorizonRepublic/nominal-types/commit/21c7c1883afcf4bb329da9edb86542f7a3e39235))
* **core:** objectOf() checks objects of nominal fields, and makes value objects ([#68](https://github.com/HorizonRepublic/nominal-types/issues/68)) ([c43980a](https://github.com/HorizonRepublic/nominal-types/commit/c43980ad78d998f2696655910dee00b0fc35837f))
* **core:** objectOf().fromEnv() reads a configuration from environment variables ([#73](https://github.com/HorizonRepublic/nominal-types/issues/73)) ([990f581](https://github.com/HorizonRepublic/nominal-types/commit/990f581e42ddbe7c15224b2afdadc0d66955ee62))
* **core:** oneOf() for fixed values and unique array items ([#84](https://github.com/HorizonRepublic/nominal-types/issues/84)) ([8bf1da4](https://github.com/HorizonRepublic/nominal-types/commit/8bf1da447b3ecf68ac42a742995bb72f62e84fc8))
* **nest:** take schemaOf() schemas and read strings in query and route values ([#42](https://github.com/HorizonRepublic/nominal-types/issues/42)) ([0cdf8cc](https://github.com/HorizonRepublic/nominal-types/commit/0cdf8cc6e7bb6abf7c44de8db7d7a97f0aa07326))
* **nest:** validate route arguments into nominal types ([#22](https://github.com/HorizonRepublic/nominal-types/issues/22)) ([bc3a51e](https://github.com/HorizonRepublic/nominal-types/commit/bc3a51e200a8488c4a399b7d5fef5160fc2aebf4))
* **swagger:** document nominal types in @nestjs/swagger ([#46](https://github.com/HorizonRepublic/nominal-types/issues/46)) ([689f94a](https://github.com/HorizonRepublic/nominal-types/commit/689f94adc849a3d11a4da54aa897cf6b2ddd3e06))
* **temporal:** Instant, PlainDate, PlainTime and PlainDateTime on Temporal ([#83](https://github.com/HorizonRepublic/nominal-types/issues/83)) ([bbddfa7](https://github.com/HorizonRepublic/nominal-types/commit/bbddfa74a2cc0843769ccb44d370e56ad4b1b297))
* **types:** add base types and put the built-ins under them ([#35](https://github.com/HorizonRepublic/nominal-types/issues/35)) ([6cd8808](https://github.com/HorizonRepublic/nominal-types/commit/6cd880874259ae6a928b3ea5db1c9793985ba4b9))
* **types:** add Email, Uuid, Url and HttpUrl ([#20](https://github.com/HorizonRepublic/nominal-types/issues/20)) ([2d0dd9c](https://github.com/HorizonRepublic/nominal-types/commit/2d0dd9c6c231c7d7789a0ba04f7a9b241fe378b7))
* **types:** CountryCode, CurrencyCode and LanguageTag ([#80](https://github.com/HorizonRepublic/nominal-types/issues/80)) ([dec0e05](https://github.com/HorizonRepublic/nominal-types/commit/dec0e05bb1eb73b0986a99b6a8b380f3ed10fc7b))
* **types:** Hostname, DomainName, IP addresses and prefixes, and MacAddress ([#85](https://github.com/HorizonRepublic/nominal-types/issues/85)) ([6f9a35d](https://github.com/HorizonRepublic/nominal-types/commit/6f9a35dd8a3708cfe92551b390933fe76afc63ba))
* **types:** Isbn, Issn, Gtin and Isin with check digits ([#86](https://github.com/HorizonRepublic/nominal-types/issues/86)) ([e900ec2](https://github.com/HorizonRepublic/nominal-types/commit/e900ec26f3f31e24a507db55f4a3c2a0ec0e9848))
* **types:** MediaType, HexColor, Base64 and Base64Url ([#81](https://github.com/HorizonRepublic/nominal-types/issues/81)) ([21db666](https://github.com/HorizonRepublic/nominal-types/commit/21db666b61d5967205df75d147793d4c0b992120))
* **types:** NonEmptyString, NonBlankString, Port, Latitude, Longitude, Ulid, UuidV4, UuidV7, ObjectId and SemVer ([#82](https://github.com/HorizonRepublic/nominal-types/issues/82)) ([b960aa5](https://github.com/HorizonRepublic/nominal-types/commit/b960aa5c275ce010b4fcbaeb4a3e32e635c9856b))
* version 3, nominal types checked at runtime and built on Standard Schema ([ef28ef1](https://github.com/HorizonRepublic/nominal-types/commit/ef28ef1f1719785d9b401ac84efb326d5d576bf7))


### Performance

* **arktype:** build instances with a generated function per object ([0dd32cd](https://github.com/HorizonRepublic/nominal-types/commit/0dd32cd078331585c79bbb907fb90f4a933c086b))
* **core:** a brand check per type, and a cheaper array loop ([#53](https://github.com/HorizonRepublic/nominal-types/issues/53)) ([6e61896](https://github.com/HorizonRepublic/nominal-types/commit/6e61896985e10a483824b7f3ed5a1909e06220e4))
* **core:** generate one check function per type ([#51](https://github.com/HorizonRepublic/nominal-types/issues/51)) ([2e6a79f](https://github.com/HorizonRepublic/nominal-types/commit/2e6a79fccc254e200e908bac91b7f35acb863db5))
* **core:** generate types that mix rules from other libraries too ([#52](https://github.com/HorizonRepublic/nominal-types/issues/52)) ([1b3c84e](https://github.com/HorizonRepublic/nominal-types/commit/1b3c84ef504adf5008460edd687b97673e66100e))
* **core:** one generated function per type checks the value and makes the instance ([#66](https://github.com/HorizonRepublic/nominal-types/issues/66)) ([8421a19](https://github.com/HorizonRepublic/nominal-types/commit/8421a193970a55f9bb063876703f7c3e75ff148c))
* **core:** pass existing instances through parse and validate ([#21](https://github.com/HorizonRepublic/nominal-types/issues/21)) ([f5dc54f](https://github.com/HorizonRepublic/nominal-types/commit/f5dc54f68993bcb3fe7680d67cd78d3961cdef82))
