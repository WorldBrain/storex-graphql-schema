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
                    },
                    findByAge: {
                        operation: 'findObjects',
                        collection: 'user',
                        args: {age: '$age:int'}
                    },
                    updageAgeByName: {
                        operation: 'findObject',
                        collection: 'user',
                        args: {name: '$name:string', age: '$age:int'}
                    },
                },
                methods: {
                    byName: { type: 'read-only', args: { name: 'string' }, returns: { collection: 'user' } },
                    byAge: { type: 'read-only', args: { age: 'int' }, returns: { array: { collection: 'user' } } },
                    setAgeByName: { type: 'mutation', args: { name: 'string', age: 'int' }, returns: { collection: 'user' } },
                }
            })

            async byName({name} : {name : string}) {
                return this.operation('findByName', {name})
            }

            async byAge({age} : {age : number}) {
                return this.operation('findByAge', {age})
            }

            async setAgeByName(options : {name : string, age : number}) {
                await this.operation('updateAgeByName', options)
                return this.byName(options)
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
        type Mutation {
          users: UsersMutation
        }
        
        type Query {
          users: UsersQuery
        }
        
        type User {
          name: String!
          age: Int!
          id: Int!
        }
        
        type UsersMutation {
          setAgeByName(name: String!, age: Int!): User!
        }

        type UsersQuery {
          byName(name: String!): User!
          byAge(age: Int!): [User]!
        }
        `)
    })

    it('should be able to execute simple queries', async () => {
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

    it('should be able to execute return lists', async () => {
        const { storageManager, schema } = await setupTest()
        await storageManager.collection('user').createObject({name: 'joe', age: 30})
        await storageManager.collection('user').createObject({name: 'bob', age: 30})

        const result = await graphql.graphql(schema, `
        query {
            users {
                byAge(age: 30) { name, age }
            }
        }
        `)
        expect(result).toEqual({data: {
            users: {
                byAge: [
                    { name: 'joe', age: 30 },
                    { name: 'bob', age: 30 },
                ]
            }
        }})
    })
})
