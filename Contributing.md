# Contributing to YouTube Context Analyzer Extension

First off, thank you for considering contributing to YouTube Context Analyzer Extension! 🎉 It's people like you that make this extension better for everyone.

## Code of Conduct

By participating in this project, you are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md). Please report unacceptable behavior to [My Email](rishpraveen001@gmail.com).

## Table of Contents

- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [How to Contribute](#how-to-contribute)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Code Contribution](#code-contribution)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)
- [Community](#community)

## Getting Started

### Prerequisites

Before you begin, ensure you have:
- Chrome browser (latest version recommended)
- Basic knowledge of JavaScript, HTML, and CSS
- Understanding of Chrome Extension APIs
- Node.js (for development tools, if applicable)

### Development Setup

1. **Fork the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Youtube_Context_Analysis_using_API.git
   cd Youtube_Context_Analysis_using_API
   ```

2. **Load the extension in development mode**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the project folder

3. **Set up API keys for testing**
   - Get YouTube Data API key from Google Cloud Console
   - Set up at least one LLM provider (OpenAI, Hugging Face, Gemini, or Ollama)
   - Configure keys in extension options

## Development Process

We use GitHub flow, so all changes happen through pull requests:

1. Fork the repo and create your branch from `main`
2. Make your changes
3. Test your changes thoroughly
4. Update documentation if needed
5. Submit a pull request

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check the [existing issues](https://github.com/Rishpraveen/Youtube_Context_Analysis_using_API/issues) to avoid duplicates.

**When submitting a bug report, please include:**

- **Summary**: A clear and concise description of what the bug is
- **Steps to reproduce**: Numbered steps to reproduce the behavior
- **Expected behavior**: What you expected to happen
- **Actual behavior**: What actually happened
- **Screenshots**: If applicable, add screenshots to help explain the problem
- **Environment**:
  - Chrome version
  - Extension version
  - Operating system
  - YouTube video URL (if relevant)
- **Console errors**: Any error messages from the browser console
- **Extension logs**: Any relevant logs from the extension

**Use this template for bug reports:**

```markdown
## Bug Description
[Brief description of the bug]

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
[What you expected to happen]

## Actual Behavior
[What actually happened]

## Environment
- Chrome Version: [e.g., 91.0.4472.124]
- Extension Version: [e.g., 1.2.0]
- OS: [e.g., Windows 10, macOS 11.4]

## Additional Context
[Any other context about the problem]
```

### Suggesting Features

We welcome feature suggestions! Before creating a feature request:

1. Check if the feature already exists
2. Search existing issues to see if someone else has suggested it
3. Consider if the feature fits the extension's scope

**When submitting a feature request, include:**

- **Summary**: Clear and concise description of the feature
- **Problem**: What problem does this solve?
- **Solution**: Detailed description of your proposed solution
- **Alternatives**: Any alternative solutions you've considered
- **Use cases**: How would this feature be used?
- **Implementation**: If you have ideas about how to implement it

### Code Contribution

#### Areas where we need help:

- **Bug fixes**: Check our [issues labeled "bug"](https://github.com/Rishpraveen/Youtube_Context_Analysis_using_API/labels/bug)
- **Feature implementations**: Issues labeled ["enhancement"](https://github.com/Rishpraveen/Youtube_Context_Analysis_using_API/labels/enhancement)
- **Documentation**: Improvements to README, code comments, or user guides
- **Testing**: Adding unit tests or integration tests
- **Performance**: Optimizing transcript processing or API calls
- **Localization**: Adding support for more languages
- **UI/UX**: Improving the extension's interface

#### Getting started with code contributions:

1. **Find an issue to work on**
   - Look for issues labeled ["good first issue"](https://github.com/Rishpraveen/Youtube_Context_Analysis_using_API/labels/good%20first%20issue) if you're new
   - Comment on the issue to let others know you're working on it

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

3. **Make your changes**
   - Write clean, readable code
   - Follow existing code style
   - Add comments for complex logic
   - Update documentation if necessary

4. **Test your changes**
   - Test on different YouTube videos and Shorts
   - Test with different languages
   - Test error scenarios
   - Verify performance impact

## Pull Request Process

### Before submitting:

- Ensure your code follows the style guidelines
- Update the README.md if you've made significant changes
- Add or update tests if applicable
- Make sure all tests pass
- Update documentation for new features

### Submitting your PR:

1. **Title**: Use a clear and descriptive title
   - ✅ "Add support for YouTube Music videos"
   - ✅ "Fix transcript extraction for private videos"
   - ❌ "Update code"

2. **Description**: Include:
   - What changes you made and why
   - Which issue this closes (if applicable)
   - Screenshots for UI changes
   - Any breaking changes

3. **Template**: Use our PR template:

```markdown
## Description
[Brief description of changes]

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issue
Closes #[issue number]

## How Has This Been Tested?
- [ ] Tested on standard YouTube videos
- [ ] Tested on YouTube Shorts
- [ ] Tested with multiple languages
- [ ] Tested error scenarios

## Screenshots (if applicable)
[Add screenshots here]

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code where necessary
- [ ] I have updated documentation
- [ ] My changes generate no new warnings
```

### Review Process:

1. **Automated checks**: Ensure all automated checks pass
2. **Code review**: At least one maintainer will review your code
3. **Testing**: Your changes will be tested in different scenarios
4. **Feedback**: Address any feedback from reviewers
5. **Approval**: Once approved, your PR will be merged

## Style Guidelines

### JavaScript

- Use **ES6+** features where appropriate
- Use **const** and **let** instead of **var**
- Use **semicolons**
- Use **camelCase** for variables and functions
- Use **PascalCase** for classes and constructors
- Keep functions small and focused
- Use meaningful variable names

**Example:**
```javascript
// ✅ Good
const extractVideoId = (url) => {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

// ❌ Bad
function a(b) {
  var c = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&\n?#]+)/
  var d = b.match(c)
  return d ? d[1] : null
}
```

### HTML/CSS

- Use **semantic HTML** elements
- Use **BEM methodology** for CSS classes
- Prefer **CSS Grid** and **Flexbox** for layouts
- Use **relative units** (rem, em) where appropriate
- Follow **mobile-first** approach

### Chrome Extension Specific

- Follow Chrome Extension [best practices](https://developer.chrome.com/docs/extensions/mv3/getstarted/)
- Use **Manifest V3** standards
- Minimize permissions requested
- Handle errors gracefully
- Provide user feedback for long operations

### Documentation

- Use **Markdown** for documentation
- Include **code examples** for complex features
- Keep **line length** under 80 characters when possible
- Use **clear headings** and **bullet points**

## Testing Guidelines

### Manual Testing Checklist

Before submitting a PR, test these scenarios:

**Basic Functionality:**
- [ ] Extension loads without errors
- [ ] All tabs (Transcript, Comments, RAG) work
- [ ] API key validation works
- [ ] Options page saves settings correctly

**Video Support:**
- [ ] Standard YouTube videos (`/watch?v=`)
- [ ] YouTube Shorts (`/shorts/`)
- [ ] Videos with multiple language captions
- [ ] Videos without captions
- [ ] Private/restricted videos

**Features:**
- [ ] Transcript extraction works
- [ ] Comment analysis completes
- [ ] RAG queries return relevant answers
- [ ] Export functionality works
- [ ] Keyboard shortcuts work
- [ ] Manual mode works when API fails

**Performance:**
- [ ] Extension doesn't slow down YouTube
- [ ] Memory usage stays reasonable
- [ ] Large transcripts are handled properly
- [ ] Caching works correctly

**Error Handling:**
- [ ] Invalid API keys show appropriate errors
- [ ] Network failures are handled gracefully
- [ ] Rate limiting is respected
- [ ] User sees helpful error messages

## Community

### Communication Channels

- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Pull Requests**: For code review and collaboration

### Getting Help

If you need help:

1. Check the [README](README.md) and existing documentation
2. Search [existing issues](https://github.com/Rishpraveen/Youtube_Context_Analysis_using_API/issues)
3. Create a new issue with the "question" label
4. Be specific about what you're trying to do and what's not working

### Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes for significant contributions
- Special mentions for outstanding contributions

## Additional Resources

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [YouTube Data API Documentation](https://developers.google.com/youtube/v3)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Hugging Face API Documentation](https://huggingface.co/docs/api-inference)

## Questions?

Don't hesitate to ask! Create an issue with the "question" label, and we'll be happy to help.

---

**Thank you for contributing! 🚀**

Your efforts help make this extension better for everyone who wants to analyze and understand YouTube content more effectively.
