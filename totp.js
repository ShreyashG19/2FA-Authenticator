const TOTP = {
    async generate(secret, options = {}) {
        const {
            period = 30,
            digits = 6,
            timestamp = Date.now(),
            algorithm = "SHA1",
        } = options;

        const totp = new OTPAuth.TOTP({
            secret: OTPAuth.Secret.fromBase32(secret),
            algorithm: algorithm,
            digits: digits,
            period: period,
        });

        const token = totp.generate({
            timestamp: timestamp,
        });

        return token;
    },

    getSecondsRemaining(period = 30) {
        return period - (Math.floor(Date.now() / 1000) % period);
    },

    getProgress(period = 30) {
        return this.getSecondsRemaining(period) / period;
    },
};
