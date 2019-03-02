import * as graphql from "graphql";
import StorageRegistry from "@worldbrain/storex/lib/registry";
import { FieldType, CollectionFields, CollectionDefinitions } from "@worldbrain/storex/lib/types";
import { capitalize } from "./utils";
import { AutoPkType } from "./types";

const FIELD_TYPES = {
    string: graphql.GraphQLString,
    int: graphql.GraphQLInt,
    boolean: graphql.GraphQLBoolean,
}

export function exportSchemaTypes(storageRegistry : StorageRegistry, options : {autoPkType : AutoPkType}) : graphql.GraphQLSchema {
    const types = collectionsToGrapQL(storageRegistry, options)

    const queryFields = {}
    for (const [collectionName, collectionDefinition] of Object.entries(storageRegistry.collections)) {
        queryFields[collectionName] = {
            type: types[collectionName]
        }
    }

    const queryType = new graphql.GraphQLObjectType({
        name: 'Query',
        fields: queryFields
    })
    return new graphql.GraphQLSchema({query: queryType})
}

export function collectionsToGrapQL(storageRegistry : StorageRegistry, options : {autoPkType : AutoPkType}) {
    const types : {[name : string] : graphql.GraphQLObjectType} = {}
    for (const [collectionName, collectionDefinition] of Object.entries(storageRegistry.collections)) {
        types[collectionName] = new graphql.GraphQLObjectType({
            name: capitalize(collectionName),
            fields: storexToGrapQLFields(collectionDefinition.fields, options)
        })
    }
    return types
}

export function storexToGrapQLFields(collectionFields : CollectionFields, options : {autoPkType : AutoPkType}) {
    const fields = {}
    for (const [fieldName, fieldDefinition] of Object.entries(collectionFields)) {
        const fieldType = storexToGraphQLFieldType(fieldDefinition.type, options);
        fields[fieldName] = {type: fieldDefinition.optional ? fieldType : new graphql.GraphQLNonNull(fieldType)}
    }
    return fields
}

export function storexToGraphQLFieldType(fieldType : FieldType, options : {autoPkType : AutoPkType}) {
    if (fieldType === 'auto-pk') {
        fieldType = options.autoPkType
    }

    const graphQLType = FIELD_TYPES[fieldType]
    if (!graphQLType) {
        throw new Error(`Could not convert field type to GraphQL field type: ${fieldType}`)
    }
    return graphQLType
}
