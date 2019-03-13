import * as expect from 'expect'
import * as graphql from 'graphql'
import { maskErrors } from 'graphql-errors'
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
                    updateAgeByName: {
                        operation: 'updateObjects',
                        collection: 'user',
                        args: [{name: '$name:string'}, {age: '$age:int'}]
                    },
                },
                methods: {
                    byName: { type: 'query', args: { name: 'string' }, returns: { collection: 'user' } },
                    byAge: { type: 'query', args: { age: 'int' }, returns: { array: { collection: 'user' } } },
                    setAgeByName: { type: 'mutation', args: { name: 'string', age: 'int' }, returns: { collection: 'user' } },
                    positionalTest: {
                        type: 'query',
                        args: {
                            first: { type: 'string', positional: true },
                            second: { type: 'string', positional: true },
                            third: { type: 'string' },
                        },
                        returns: { array: 'string' },
                    },
                    objectReturnTest: {
                        type: 'query',
                        args: {},
                        returns: { object: { foo: 'string', bar: 'int' } }
                    },
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

            async positionalTest(first : string, second : string, options : {third : string}) {
                return [first, second, options.third]
            }

            async objectReturnTest() {
                return { foo: 'eggs', bar: 42 }
            }
        }

        const { storageManager, modules } = await setupStorexTest<{users : UserModule}>({
            collections: {},
            modules: {
                users: ({storageManager}) => new UserModule({storageManager})
            }
        })
        const schema = createStorexGraphQLSchema(modules, {storageManager, autoPkType: 'int', graphql})
        maskErrors(schema)
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
          positionalTest(first: String!, second: String!, third: String!): [String]!
          objectReturnTest: UsersQueryObjectReturnTestReturnType!
        }

        type UsersQueryObjectReturnTestReturnType {
          foo: String!
          bar: Int!
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

    it('should be able to return lists', async () => {
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

    it('should be able to return objects', async () => {
        const { storageManager, schema } = await setupTest()

        const result = await graphql.graphql(schema, `
        query {
            users {
                objectReturnTest { foo, bar }
            }
        }
        `)
        expect(result).toEqual({data: {
            users: {
                objectReturnTest: {
                    foo: 'eggs',
                    bar: 42,
                }
            }
        }})
    })

    it('should be able to process positional arguments', async () => {
        const { storageManager, schema } = await setupTest()
        const result = await graphql.graphql(schema, `
        query {
            users {
                positionalTest(first: "foo", second: "bar", third: "eggs")
            }
        }
        `)
        expect(result).toEqual({data: {
            users: {
                positionalTest: ['foo', 'bar', 'eggs']
            }
        }})
    })

    it('should be able to execute mutations', async () => {
        const { storageManager, schema } = await setupTest()
        const { object } = await storageManager.collection('user').createObject({name: 'joe', age: 30})

        const result = await graphql.graphql(schema, `
        mutation {
            users {
                setAgeByName(name: "joe", age: 40) { id, name, age }
            }
        }
        `)
        expect(result).toEqual({data: {
            users: {
                setAgeByName: { id: object.id, name: 'joe', age: 40 },
            }
        }})
    })
})
