/** Native sharp is not available inside Cloudflare Workers. Image work uses the Images binding. */
const sharp = () => {
  throw new Error('sharp is not available on Cloudflare Workers');
};
export default sharp;
