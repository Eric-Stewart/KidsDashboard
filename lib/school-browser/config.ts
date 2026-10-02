export class CollectorError extends Error {}
export interface CollectorConfig { dashboard:{url:string}; classroom:Record<"E"|"A",{username:string;password:string}>; genesis:{username:string;password:string;studentIds:Record<"E"|"A",string>} }
