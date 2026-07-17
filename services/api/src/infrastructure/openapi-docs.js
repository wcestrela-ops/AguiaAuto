function isOpenApiDocsEnabled() {
  return process.env.OPENAPI_DOCS_ENABLED !== 'false';
}

module.exports = { isOpenApiDocsEnabled };
