import * as expect from 'expect'
import * as graphql from "graphql";
import StorageRegistry from '@worldbrain/storex/lib/registry'
import { CollectionDefinitionMap, CollectionFields, CollectionField } from '@worldbrain/storex/lib/types';
import { exportSchemaTypes } from './schema';
import { FieldTypeRegistry } from '@worldbrain/storex/lib/fields';

describe('Schema generation', () => {
    describe('Type generation', () => {
        async function runTest(options : {collections : CollectionDefinitionMap, expect : string}) {
            const registry = new StorageRegistry({fieldTypes: new FieldTypeRegistry()})
            registry.registerCollections(options.collections)
            await registry.finishInitialization()

            const expectLines = options.expect.split('\n')
            const secondExpectLine = expectLines[1]
            const leadingSpaces = /^\s+/.exec(secondExpectLine)[0]
            const expectWithoutLeadingSpaces = expectLines.slice(1, -1).map(line => line.slice(leadingSpaces.length)).join('\n')
            expect(graphql.printSchema(exportSchemaTypes(registry, {autoPkType: 'int'})).trim()).toEqual(expectWithoutLeadingSpaces)
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