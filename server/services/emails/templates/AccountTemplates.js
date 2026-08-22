const EmailBuilder = require('../EmailBuilder');

const AccountTemplates = {
    welcomeTemplate(data) {
        const content = [
            EmailBuilder.buildHeader(),
            EmailBuilder.buildStatusBanner('Welcome to AutoMatrix!', 'Your premium auto parts hub.', EmailBuilder.theme.primary, '🎉'),
            EmailBuilder.buildGreeting(data.customerName),
            EmailBuilder.buildMessage('Thank you for creating an account with AutoMatrix! We are thrilled to have you on board.'),
            EmailBuilder.buildNextSteps([
                'Browse our extensive catalog of premium auto parts.',
                'Manage your addresses and track your orders easily from your dashboard.',
                'Enjoy exclusive member deals and fast shipping.'
            ]),
            EmailBuilder.buildButton('Start Shopping', `https://automobiles.live`),
            EmailBuilder.buildSupportSection()
        ].join('');

        return EmailBuilder.buildLayout(content, 'Welcome to AutoMatrix');
    },

    accountVerificationTemplate(data) {
        const content = [
            EmailBuilder.buildHeader(),
            EmailBuilder.buildStatusBanner('Verify Your Email', 'Complete your registration.', EmailBuilder.theme.primary, '✉️'),
            EmailBuilder.buildGreeting(data.customerName),
            EmailBuilder.buildMessage('Please use the verification code below to verify your email address and complete your signup.'),
            `
            <tr>
                <td align="center" style="padding: 20px 30px; font-family: ${EmailBuilder.theme.fontFamily};">
                    <div style="background-color: #F8FAFC; border-radius: 8px; padding: 20px; display: inline-block; min-width: 200px;">
                        <p style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: ${EmailBuilder.theme.text};">${data.otp}</p>
                    </div>
                </td>
            </tr>
            `,
            EmailBuilder.buildMessage(`This code expires in ${data.minutesValid || 10} minutes.`),
            EmailBuilder.buildNextSteps([
                'Enter this code on the verification page.',
                'If you did not request this, please ignore this email.'
            ]),
            EmailBuilder.buildSupportSection()
        ].join('');

        return EmailBuilder.buildLayout(content, 'Verify your email for AutoMatrix');
    },

    passwordResetTemplate(data) {
        const content = [
            EmailBuilder.buildHeader(),
            EmailBuilder.buildStatusBanner('Password Reset', 'Reset your AutoMatrix password.', EmailBuilder.theme.primary, '🔒'),
            EmailBuilder.buildGreeting(data.customerName),
            EmailBuilder.buildMessage('We received a request to reset your password. Click the button below to choose a new one.'),
            EmailBuilder.buildButton('Reset Password', data.resetLink),
            EmailBuilder.buildMessage('This link is valid for 1 hour. If you did not request a password reset, you can safely ignore this email; your password will remain unchanged.'),
            EmailBuilder.buildSupportSection()
        ].join('');

        return EmailBuilder.buildLayout(content, 'Password Reset Request');
    }
};

module.exports = AccountTemplates;
