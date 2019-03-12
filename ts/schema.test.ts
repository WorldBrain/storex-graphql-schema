import * as graphql from 'graphql'
import StorageRegistry from '@worldbrain/storex/lib/registry'
import { CollectionDefinitionMap, CollectionFields, CollectionField } from '@worldbrain/storex/lib/types';
import { exportSchemaTypes } from './schema';
import { FieldTypeRegistry } from '@worldbrain/storex/lib/fields';
import { expectGraphQLSchemaToEqual } from './index.tests';

describe('Schema generation', () => {
    describe('Type generation', () => {
        async function runTest(options : {collections : CollectionDefinitionMap, expect : string}) {
            const registry = new StorageRegistry({fieldTypes: new FieldTypeRegistry()})
            registry.registerCollections(options.collections)
            await registry.finishInitialization()
            expectGraphQLSchemaToEqual(exportSchemaTypes(registry, {autoPkType: 'int', graphql}), options.expect)
        }

        async function runSimpleTest(options : {collectionName : string, collectionFields : CollectionFields, expect : string}) {
            await runTest({
                collections: {
                    [options.collectionName]: {
                        version: new Date('2019-01-01'),
                        fields: options.collectionFields
                    }
                },
                expect: options.expect,
            })
        }

        async function runFieldTest(fiedDefinition : CollectionField, expected : string) {
            await runSimpleTest({
                collectionName: 'object',
                collectionFields: {
                    field: fiedDefinition,
                },
                expect: `
                type Object {
                  field: ${expected}
                  id: Int!
                }

                type Query {
                  object: Object
                }
                `
            })
        }

        it('should be able to generate types containing required string fields', async () => {
            await runFieldTest({type: 'string'}, 'String!')
        })
        
        it('should be able to generate types containing optional string fields', async () => {
            await runFieldTest({type: 'string', optional: true}, 'String')
        })

        it('should be able to generate types containing required int fields', async () => {
            await runFieldTest({type: 'int'}, 'Int!')
        })
        
        it('should be able to generate types containing optional int fields', async () => {
            await runFieldTest({type: 'int', optional: true}, 'Int')
        })

        it('should be able to generate types containing required int fields', async () => {
            await runFieldTest({type: 'boolean'}, 'Boolean!')
        })
        
        it('should be able to generate types containing optional int fields', async () => {
            await runFieldTest({type: 'boolean', optional: true}, 'Boolean')
        })
    })
})