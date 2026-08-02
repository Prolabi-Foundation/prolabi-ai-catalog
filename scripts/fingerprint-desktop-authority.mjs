import { fingerprintConsumerAuthority, parseArguments, requiredAbsolutePath } from './lib/contracts.mjs';

const arguments_ = parseArguments(process.argv.slice(2), ['desktop-dir']);
const desktopRoot = requiredAbsolutePath(arguments_, 'desktop-dir');
process.stdout.write(
  `${JSON.stringify({
    authority_sha256: fingerprintConsumerAuthority(desktopRoot),
  })}\n`,
);
