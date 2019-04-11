export type AutoPkType = 'int' | 'string'
export type StorexGraphQLSchemaEvent =
    {type: 'call.incoming', moduleName : string, methodName : string, argsObject : any} |
    {type: 'call.prepared', moduleName : string, methodName : string, args : any[]} |
    {type: 'call.processed', moduleName : string, methodName : string, returnValue : any}
