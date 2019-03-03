import * as expect from 'expect'
import { makeExecutableSchema } from 'graphql-tools'
import * as graphql from 'graphql'
import { StorageModule, StorageModuleConfig } from '@worldbrain/storex-pattern-modules'
import { setupStorexTest } from '@worldbrain/storex-pattern-modules/lib/index.tests'
import { createStorexGraphQLSchema } from './modules';
import { PublicMethodDefinitions, StorageModuleConfigWithMethods } from './types';
import { expectGraphQLSchemaToEqual } from './index.tests';

describe('StorageModule translation', () => {
    // https://graphql.org/graphql-js/constructing-types/

    it('should be able to give access to a StorageModule trough a GraphQL API', async () => {
        class UserModule extends StorageModule {
            getConfig = () : StorageModuleConfigWithMethods => ({
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
                    byName: { args: { name: 'string' }, returns: { collection: 'user' } }
                }
            })

            async byName({name} : {name : string}) {
                return this.operation('findByName', {name})
            }
        }

        const { storageManager, modules } = await setupStorexTest<{users : UserModule}>({
            collections: {},
            modules: {
                users: ({storageManager}) => new UserModule({storageManager})
            }
        })
        await storageManager.collection('user').createObject({name: 'joe', age: 30})

        const schema = createStorexGraphQLSchema({storageManager, modules, autoPkType: 'int'})
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
          byName(name: String!): User
        }
        `)

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
