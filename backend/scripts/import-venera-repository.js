const { DEFAULT_VENERA_REPOSITORY, importVeneraRepository } = require('../dist/services/venera-sources')

async function main() {
  const url = process.argv[2] || DEFAULT_VENERA_REPOSITORY
  const config = await importVeneraRepository(url)
  const total = config.repositories.reduce((sum, repository) => sum + repository.sources.length, 0)
  console.log(`Venera repository imported: ${total} sources from ${url}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
