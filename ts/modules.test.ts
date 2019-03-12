import * as expect from 'expect'
import * as graphql from 'graphql'
import { StorageModule, StorageModuleConfig } from '@worldbrain/storex-pattern-modules'
import { setupStorexTest } from '@worldbrain/storex-pattern-modules/lib/index.tests'
import { createStorexGraphQLSchema } from './modules'
import { expectGraphQLSchemaToEqual } from './index.tests'

describe('StorageModule translation', () => {
    // https://graphql.org/graphql-js/constructing-types/

    async function setupTest() {
        class UserModule extends StorageModule {
            getConfig = () : StorageModuleConfig => ({
                collections: {
                    user: {
                        version: new Date('2019-01-01'),
                        fields: {
                            name: {type: 'string'},
                            age: {type: 'int'}
                        }
                    }
                },
                operations: {
                    findByName: {
                        operation: 'findObject',
                        collection: 'user',
                        args: {name: '$name:string'}
                    }
                },
                methods: {
                    byName: { type: 'read-only', args: { name: 'string' }, returns: { collection: 'user' } },
                    byAge: { type: 'read-only', args: { age: 'int' }, returns: { array: { collection: 'user' } } }
                }
            })

            async byName({name} : {name : string}) {
                return this.operation('findByName', {name})
            }

            async byAge({age} : {age : number}) {
                return this.operation('findByAge', {age})
            }
        }

        const { storageManager, modules } = await setupStorexTest<{users : UserModule}>({
            collections: {},
            modules: {
                users: ({storageManager}) => new UserModule({storageManager})
            }
        })
        const schema = createStorexGraphQLSchema(modules, {storageManager, autoPkType: 'int', graphql})
        return { storageManager, modules, schema }
    }

    it('should be able generate a GraphQL schema for StorageModules', async () => {
        const { schema } = await setupTest()
        expectGraphQLSchemaToEqual(schema, `
        type Query {
          users: Users
        }
        
        type User {
          name: String!
          age: Int!
          id: Int!
        }
        
        type Users {
          byName(name: String!): User!
          byAge(age: Int!): [User]!
        }
        `)
    })

    it('should be able to give access to a StorageModule trough a GraphQL API', async () => {
        const { storageManager, schema } = await setupTest()
        await storageManager.collection('user').createObject({name: 'joe', age: 30})

        const result = await graphql.graphql(schema, `
        query {
            users {
                byName(name: "joe") { name, age }
            }
        }
        `)
        expect(result).toEqual({data: {
            users: {
                byName: {
                    name: 'joe',
                    age: 30,
                }
            }
        }})
    })
})
