module.exports = {
    plugins: {
        'tailwindcss/nesting': {},
        tailwindcss: {},
        autoprefixer: {},
        ...(process.env.NODE_ENV === 'production'
            ? {
                cssnano: {
                    preset: ['default', { discardComments: { removeAll: true } }],
                },
            }
            : {}),
    },
} 