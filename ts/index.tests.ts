import * as expect from 'expect'
import * as graphql from "graphql";
export function expectGraphQLSchemaToEqual(schema : graphql.GraphQLSchema, expected : string) {
    const expectLines = expected.split('\n')
    const secondExpectLine = expectLines[1]
    const leadingSpaces = /^\s+/.exec(secondExpectLine)[0]
    const expectWithoutLeadingSpaces = expectLines.slice(1, -1).map(line => line.slice(leadingSpaces.length)).join('\n')
    expect(graphql.printSchema(schema).trim()).toEqual(expectWithoutLeadingSpaces)
}