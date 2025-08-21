let currentEmployee = null;
let employeeId = null;
let isEmployeeView = false; // true if accessed via employee secure link



const SOFT_SKILLS_DATA = {
    'business_communication': {
        id: 'business_communication',
        prerequisites: [],
        nameKey: 'soft_skill_business_communication',
        descKey: 'soft_skill_business_communication_desc',
        benefitKey: 'soft_skill_business_communication_benefit'
    },
    'communication': {
        id: 'communication',
        prerequisites: ['business_communication'],
        nameKey: 'soft_skill_communication',
        descKey: 'soft_skill_communication_desc',
        benefitKey: 'soft_skill_communication_benefit'
    },
    'presentation': {
        id: 'presentation',
        prerequisites: ['communication'],
        nameKey: 'soft_skill_presentation',
        descKey: 'soft_skill_presentation_desc',
        benefitKey: 'soft_skill_presentation_benefit'
    },
    'client_centricity': {
        id: 'client_centricity',
        prerequisites: [],
        nameKey: 'soft_skill_client_centricity',
        descKey: 'soft_skill_client_centricity_desc',
        benefitKey: 'soft_skill_client_centricity_benefit'
    },
    'emotional_intelligence': {
        id: 'emotional_intelligence',
        prerequisites: ['client_centricity'],
        nameKey: 'soft_skill_emotional_intelligence',
        descKey: 'soft_skill_emotional_intelligence_desc',
        benefitKey: 'soft_skill_emotional_intelligence_benefit'
    },
    'mentoring': {
        id: 'mentoring',
        prerequisites: ['emotional_intelligence', 'communication'],
        nameKey: 'soft_skill_mentoring',
        descKey: 'soft_skill_mentoring_desc',
        benefitKey: 'soft_skill_mentoring_benefit'
    },
    'management': {
        id: 'management',
        prerequisites: ['mentoring', 'presentation'],
        nameKey: 'soft_skill_management',
        descKey: 'soft_skill_management_desc',
        benefitKey: 'soft_skill_management_benefit'
    },
    'cognitive_flexibility': {
        id: 'cognitive_flexibility',
        prerequisites: [],
        nameKey: 'soft_skill_cognitive_flexibility',
        descKey: 'soft_skill_cognitive_flexibility_desc',
        benefitKey: 'soft_skill_cognitive_flexibility_benefit'
    },
    'creative_thinking': {
        id: 'creative_thinking',
        prerequisites: ['cognitive_flexibility'],
        nameKey: 'soft_skill_creative_thinking',
        descKey: 'soft_skill_creative_thinking_desc',
        benefitKey: 'soft_skill_creative_thinking_benefit'
    },
    'critical_thinking': {
        id: 'critical_thinking',
        prerequisites: ['creative_thinking'],
        nameKey: 'soft_skill_critical_thinking',
        descKey: 'soft_skill_critical_thinking_desc',
        benefitKey: 'soft_skill_critical_thinking_benefit'
    },
    'problem_solving': {
        id: 'problem_solving',
        prerequisites: ['critical_thinking'],
        nameKey: 'soft_skill_problem_solving',
        descKey: 'soft_skill_problem_solving_desc',
        benefitKey: 'soft_skill_problem_solving_benefit'
    },
    'systems_thinking': {
        id: 'systems_thinking',
        prerequisites: ['cognitive_flexibility'],
        nameKey: 'soft_skill_systems_thinking',
        descKey: 'soft_skill_systems_thinking_desc',
        benefitKey: 'soft_skill_systems_thinking_benefit'
    },
    'goal_setting': {
        id: 'goal_setting',
        prerequisites: ['systems_thinking'],
        nameKey: 'soft_skill_goal_setting',
        descKey: 'soft_skill_goal_setting_desc',
        benefitKey: 'soft_skill_goal_setting_benefit'
    },
    'resource_management': {
        id: 'resource_management',
        prerequisites: ['goal_setting', 'problem_solving'],
        nameKey: 'soft_skill_resource_management',
        descKey: 'soft_skill_resource_management_desc',
        benefitKey: 'soft_skill_resource_management_benefit'
    },
    'stress_management': {
        id: 'stress_management',
        prerequisites: ['goal_setting'],
        nameKey: 'soft_skill_stress_management',
        descKey: 'soft_skill_stress_management_desc',
        benefitKey: 'soft_skill_stress_management_benefit'
    }

};
autoLayoutCompactDAG(SOFT_SKILLS_DATA, { r: 50, minSep: 120, layerGap: 160 });



const HARD_SKILLS_DATA = {
    'backend': {
        'internet': { id: 'internet', prerequisites: [], name: 'Internet', desc: 'How the internet works', benefit: 'Understanding of web fundamentals' },
        'http': { id: 'http', prerequisites: ['internet'], name: 'HTTP/HTTPS', desc: 'Web communication protocols', benefit: 'Secure web communication' },
        'domain_names': { id: 'domain_names', prerequisites: ['internet'], name: 'Domain Names', desc: 'DNS and domain system', benefit: 'Web addressing knowledge' },
        'hosting': { id: 'hosting', prerequisites: ['http', 'domain_names'], name: 'Hosting', desc: 'Web hosting concepts', benefit: 'Application deployment knowledge' },
        
        'javascript': { id: 'javascript', prerequisites: [], name: 'JavaScript', desc: 'Programming language for web development', benefit: 'Dynamic web applications' },
        'python': { id: 'python', prerequisites: [], name: 'Python', desc: 'Versatile programming language', benefit: 'Rapid development capabilities' },
        'java': { id: 'java', prerequisites: [], name: 'Java', desc: 'Enterprise programming language', benefit: 'Scalable applications' },
        'go': { id: 'go', prerequisites: [], name: 'Go', desc: 'Modern systems programming', benefit: 'High-performance services' },
        'rust': { id: 'rust', prerequisites: [], name: 'Rust', desc: 'Systems programming language', benefit: 'Memory-safe performance' },
        
        'git': { id: 'git', prerequisites: [], name: 'Git', desc: 'Version control system', benefit: 'Code collaboration and history' },
        'github': { id: 'github', prerequisites: ['git'], name: 'GitHub', desc: 'Git hosting platform', benefit: 'Team collaboration' },
        'gitlab': { id: 'gitlab', prerequisites: ['git'], name: 'GitLab', desc: 'DevOps platform', benefit: 'Integrated development workflow' },
        
        'relational_databases': { id: 'relational_databases', prerequisites: [], name: 'Relational Databases', desc: 'SQL-based data storage', benefit: 'Structured data management' },
        'postgresql': { id: 'postgresql', prerequisites: ['relational_databases'], name: 'PostgreSQL', desc: 'Advanced relational database', benefit: 'Enterprise data solutions' },
        'mysql': { id: 'mysql', prerequisites: ['relational_databases'], name: 'MySQL', desc: 'Popular relational database', benefit: 'Web application data storage' },
        'mongodb': { id: 'mongodb', prerequisites: [], name: 'MongoDB', desc: 'NoSQL document database', benefit: 'Flexible data modeling' },
        'redis': { id: 'redis', prerequisites: [], name: 'Redis', desc: 'In-memory data store', benefit: 'High-performance caching' },
        
        'rest_apis': { id: 'rest_apis', prerequisites: ['http'], name: 'REST APIs', desc: 'RESTful web services', benefit: 'Standardized API design' },
        'graphql': { id: 'graphql', prerequisites: ['rest_apis'], name: 'GraphQL', desc: 'Query language for APIs', benefit: 'Efficient data fetching' },
        'soap': { id: 'soap', prerequisites: ['rest_apis'], name: 'SOAP', desc: 'Protocol for web services', benefit: 'Enterprise integration' },
        
        'nodejs': { id: 'nodejs', prerequisites: ['javascript'], name: 'Node.js', desc: 'JavaScript runtime for servers', benefit: 'Full-stack JavaScript development' },
        'express': { id: 'express', prerequisites: ['nodejs'], name: 'Express.js', desc: 'Web framework for Node.js', benefit: 'Rapid API development' },
        'nestjs': { id: 'nestjs', prerequisites: ['nodejs'], name: 'NestJS', desc: 'Progressive Node.js framework', benefit: 'Scalable server applications' },
        
        'django': { id: 'django', prerequisites: ['python'], name: 'Django', desc: 'Python web framework', benefit: 'Rapid web development' },
        'flask': { id: 'flask', prerequisites: ['python'], name: 'Flask', desc: 'Lightweight Python framework', benefit: 'Flexible web applications' },
        'fastapi': { id: 'fastapi', prerequisites: ['python'], name: 'FastAPI', desc: 'Modern Python API framework', benefit: 'High-performance APIs' },
        
        'spring': { id: 'spring', prerequisites: ['java'], name: 'Spring', desc: 'Java application framework', benefit: 'Enterprise Java development' },
        'spring_boot': { id: 'spring_boot', prerequisites: ['spring'], name: 'Spring Boot', desc: 'Rapid Spring development', benefit: 'Microservices architecture' },
        
        'docker': { id: 'docker', prerequisites: [], name: 'Docker', desc: 'Containerization platform', benefit: 'Consistent deployment environments' },
        'kubernetes': { id: 'kubernetes', prerequisites: ['docker'], name: 'Kubernetes', desc: 'Container orchestration', benefit: 'Scalable container management' },
        'aws': { id: 'aws', prerequisites: [], name: 'AWS', desc: 'Amazon cloud services', benefit: 'Scalable cloud infrastructure' },
        'azure': { id: 'azure', prerequisites: [], name: 'Azure', desc: 'Microsoft cloud platform', benefit: 'Enterprise cloud solutions' },
        'gcp': { id: 'gcp', prerequisites: [], name: 'Google Cloud', desc: 'Google cloud platform', benefit: 'Modern cloud infrastructure' },
        
        'testing': { id: 'testing', prerequisites: [], name: 'Testing', desc: 'Automated testing frameworks', benefit: 'Code quality assurance' },
        'unit_testing': { id: 'unit_testing', prerequisites: ['testing'], name: 'Unit Testing', desc: 'Component-level testing', benefit: 'Reliable code components' },
        'integration_testing': { id: 'integration_testing', prerequisites: ['testing'], name: 'Integration Testing', desc: 'System integration testing', benefit: 'End-to-end reliability' },
        'e2e_testing': { id: 'e2e_testing', prerequisites: ['integration_testing'], name: 'E2E Testing', desc: 'End-to-end testing', benefit: 'Complete user flow validation' }
    },
    'frontend': {
        'html': { id: 'html', prerequisites: [], name: 'HTML', desc: 'Markup language for web pages', benefit: 'Web page structure' },
        'css': { id: 'css', prerequisites: ['html'], name: 'CSS', desc: 'Styling language for web pages', benefit: 'Visual presentation control' },
        'javascript': { id: 'javascript', prerequisites: ['css'], name: 'JavaScript', desc: 'Programming language for web interactivity', benefit: 'Dynamic user interfaces' },
        
        'semantic_html': { id: 'semantic_html', prerequisites: ['html'], name: 'Semantic HTML', desc: 'Meaningful HTML structure', benefit: 'Accessibility and SEO' },
        'forms': { id: 'forms', prerequisites: ['html'], name: 'Forms & Validations', desc: 'User input handling', benefit: 'Interactive web forms' },
        'accessibility': { id: 'accessibility', prerequisites: ['semantic_html'], name: 'Accessibility', desc: 'Web accessibility standards', benefit: 'Inclusive user experiences' },
        'seo': { id: 'seo', prerequisites: ['semantic_html'], name: 'SEO Basics', desc: 'Search engine optimization', benefit: 'Better search visibility' },
        
        'css_grid': { id: 'css_grid', prerequisites: ['css'], name: 'CSS Grid', desc: 'Two-dimensional layout system', benefit: 'Complex layout control' },
        'flexbox': { id: 'flexbox', prerequisites: ['css'], name: 'Flexbox', desc: 'One-dimensional layout method', benefit: 'Flexible component layouts' },
        'responsive_design': { id: 'responsive_design', prerequisites: ['css_grid', 'flexbox'], name: 'Responsive Design', desc: 'Multi-device compatibility', benefit: 'Universal device support' },
        
        'sass': { id: 'sass', prerequisites: ['css'], name: 'Sass/SCSS', desc: 'CSS preprocessor', benefit: 'Enhanced CSS capabilities' },
        'less': { id: 'less', prerequisites: ['css'], name: 'Less', desc: 'CSS preprocessor', benefit: 'Dynamic stylesheet language' },
        'postcss': { id: 'postcss', prerequisites: ['css'], name: 'PostCSS', desc: 'CSS transformation tool', benefit: 'Modern CSS features' },
        
        'tailwind': { id: 'tailwind', prerequisites: ['responsive_design'], name: 'Tailwind CSS', desc: 'Utility-first CSS framework', benefit: 'Rapid UI development' },
        'bootstrap': { id: 'bootstrap', prerequisites: ['responsive_design'], name: 'Bootstrap', desc: 'CSS component framework', benefit: 'Quick responsive layouts' },
        
        'dom_manipulation': { id: 'dom_manipulation', prerequisites: ['javascript'], name: 'DOM Manipulation', desc: 'Dynamic HTML modification', benefit: 'Interactive web pages' },
        'fetch_api': { id: 'fetch_api', prerequisites: ['javascript'], name: 'Fetch API / Ajax', desc: 'Asynchronous data fetching', benefit: 'Dynamic content loading' },
        'es6_modules': { id: 'es6_modules', prerequisites: ['javascript'], name: 'ES6+ & Modules', desc: 'Modern JavaScript features', benefit: 'Modular code organization' },
        
        'typescript': { id: 'typescript', prerequisites: ['es6_modules'], name: 'TypeScript', desc: 'Typed JavaScript superset', benefit: 'Type-safe development' },
        
        'react': { id: 'react', prerequisites: ['javascript'], name: 'React', desc: 'JavaScript library for building UIs', benefit: 'Component-based development' },
        'vue': { id: 'vue', prerequisites: ['javascript'], name: 'Vue.js', desc: 'Progressive JavaScript framework', benefit: 'Flexible UI development' },
        'angular': { id: 'angular', prerequisites: ['typescript'], name: 'Angular', desc: 'Full-featured frontend framework', benefit: 'Enterprise application development' },
        'svelte': { id: 'svelte', prerequisites: ['javascript'], name: 'Svelte', desc: 'Compile-time framework', benefit: 'Optimized runtime performance' },
        
        'redux': { id: 'redux', prerequisites: ['react'], name: 'Redux', desc: 'State management for React', benefit: 'Predictable state updates' },
        'context_api': { id: 'context_api', prerequisites: ['react'], name: 'Context API', desc: 'React state management', benefit: 'Component state sharing' },
        'react_router': { id: 'react_router', prerequisites: ['react'], name: 'React Router', desc: 'Client-side routing', benefit: 'Single-page applications' },
        
        'vuex': { id: 'vuex', prerequisites: ['vue'], name: 'Vuex', desc: 'State management for Vue', benefit: 'Centralized state management' },
        'vue_router': { id: 'vue_router', prerequisites: ['vue'], name: 'Vue Router', desc: 'Vue.js routing', benefit: 'Navigation management' },
        
        'webpack': { id: 'webpack', prerequisites: ['es6_modules'], name: 'Webpack', desc: 'Module bundler', benefit: 'Optimized application builds' },
        'vite': { id: 'vite', prerequisites: ['es6_modules'], name: 'Vite', desc: 'Fast build tool', benefit: 'Lightning-fast development' },
        'parcel': { id: 'parcel', prerequisites: ['es6_modules'], name: 'Parcel', desc: 'Zero-config bundler', benefit: 'Simple build process' },
        
        'jest': { id: 'jest', prerequisites: ['javascript'], name: 'Jest', desc: 'JavaScript testing framework', benefit: 'Reliable code testing' },
        'cypress': { id: 'cypress', prerequisites: ['jest'], name: 'Cypress', desc: 'End-to-end testing', benefit: 'Complete user flow testing' },
        'testing_library': { id: 'testing_library', prerequisites: ['react'], name: 'Testing Library', desc: 'Component testing utilities', benefit: 'User-focused testing' },
        
        'pwa': { id: 'pwa', prerequisites: ['fetch_api'], name: 'Progressive Web Apps', desc: 'App-like web experiences', benefit: 'Native app features' },
        'web_components': { id: 'web_components', prerequisites: ['dom_manipulation'], name: 'Web Components', desc: 'Reusable custom elements', benefit: 'Framework-agnostic components' }
    },
    'devops': {
        'linux': { id: 'linux', prerequisites: [], name: 'Linux', desc: 'Operating system fundamentals', benefit: 'Server management skills' },
        'terminal': { id: 'terminal', prerequisites: ['linux'], name: 'Terminal Usage', desc: 'Command line proficiency', benefit: 'Efficient system operations' },
        'bash_scripting': { id: 'bash_scripting', prerequisites: ['terminal'], name: 'Bash Scripting', desc: 'Shell script automation', benefit: 'Task automation' },
        
        'networking': { id: 'networking', prerequisites: ['linux'], name: 'Networking', desc: 'Network protocols and concepts', benefit: 'Infrastructure connectivity' },
        'security': { id: 'security', prerequisites: ['networking'], name: 'Security', desc: 'System and network security', benefit: 'Secure infrastructure' },
        'protocols': { id: 'protocols', prerequisites: ['networking'], name: 'Protocols', desc: 'HTTP, HTTPS, FTP, SSH', benefit: 'Communication standards' },
        
        'git': { id: 'git', prerequisites: [], name: 'Git', desc: 'Version control system', benefit: 'Code collaboration' },
        'github_actions': { id: 'github_actions', prerequisites: ['git'], name: 'GitHub Actions', desc: 'CI/CD automation', benefit: 'Automated workflows' },
        
        'docker': { id: 'docker', prerequisites: ['linux'], name: 'Docker', desc: 'Containerization platform', benefit: 'Consistent environments' },
        'docker_compose': { id: 'docker_compose', prerequisites: ['docker'], name: 'Docker Compose', desc: 'Multi-container applications', benefit: 'Complex application orchestration' },
        'kubernetes': { id: 'kubernetes', prerequisites: ['docker'], name: 'Kubernetes', desc: 'Container orchestration', benefit: 'Scalable deployments' },
        'helm': { id: 'helm', prerequisites: ['kubernetes'], name: 'Helm', desc: 'Kubernetes package manager', benefit: 'Application deployment management' },
        
        'aws': { id: 'aws', prerequisites: [], name: 'AWS', desc: 'Amazon Web Services', benefit: 'Cloud infrastructure' },
        'ec2': { id: 'ec2', prerequisites: ['aws'], name: 'EC2', desc: 'Virtual servers', benefit: 'Scalable compute resources' },
        's3': { id: 's3', prerequisites: ['aws'], name: 'S3', desc: 'Object storage service', benefit: 'Reliable data storage' },
        'rds': { id: 'rds', prerequisites: ['aws'], name: 'RDS', desc: 'Managed database service', benefit: 'Database management' },
        
        'azure': { id: 'azure', prerequisites: [], name: 'Azure', desc: 'Microsoft cloud platform', benefit: 'Enterprise cloud solutions' },
        'gcp': { id: 'gcp', prerequisites: [], name: 'Google Cloud', desc: 'Google cloud platform', benefit: 'Modern cloud services' },
        
        'terraform': { id: 'terraform', prerequisites: ['aws', 'azure'], name: 'Terraform', desc: 'Infrastructure as Code', benefit: 'Automated infrastructure' },
        'ansible': { id: 'ansible', prerequisites: ['linux'], name: 'Ansible', desc: 'Configuration management', benefit: 'Automated configuration' },
        'puppet': { id: 'puppet', prerequisites: ['linux'], name: 'Puppet', desc: 'Configuration management', benefit: 'Infrastructure automation' },
        
        'jenkins': { id: 'jenkins', prerequisites: ['git'], name: 'Jenkins', desc: 'CI/CD automation server', benefit: 'Continuous integration' },
        'gitlab_ci': { id: 'gitlab_ci', prerequisites: ['git'], name: 'GitLab CI', desc: 'Integrated CI/CD', benefit: 'Streamlined pipelines' },
        'circleci': { id: 'circleci', prerequisites: ['git'], name: 'CircleCI', desc: 'Cloud CI/CD platform', benefit: 'Fast automated testing' },
        
        'prometheus': { id: 'prometheus', prerequisites: ['kubernetes'], name: 'Prometheus', desc: 'Monitoring system', benefit: 'System observability' },
        'grafana': { id: 'grafana', prerequisites: ['prometheus'], name: 'Grafana', desc: 'Visualization platform', benefit: 'Monitoring dashboards' },
        'elk_stack': { id: 'elk_stack', prerequisites: ['linux'], name: 'ELK Stack', desc: 'Log management', benefit: 'Centralized logging' },
        'datadog': { id: 'datadog', prerequisites: ['aws'], name: 'Datadog', desc: 'Monitoring platform', benefit: 'Application performance monitoring' }
    },
    'qa': {
        'testing_fundamentals': { id: 'testing_fundamentals', prerequisites: [], name: 'Testing Fundamentals', desc: 'Basic testing principles', benefit: 'Quality assurance foundation' },
        'test_planning': { id: 'test_planning', prerequisites: ['testing_fundamentals'], name: 'Test Planning', desc: 'Test strategy and planning', benefit: 'Systematic testing approach' },
        'test_design': { id: 'test_design', prerequisites: ['test_planning'], name: 'Test Design', desc: 'Test case design techniques', benefit: 'Effective test coverage' },
        
        'manual_testing': { id: 'manual_testing', prerequisites: ['testing_fundamentals'], name: 'Manual Testing', desc: 'Human-executed testing', benefit: 'Exploratory testing capabilities' },
        'exploratory_testing': { id: 'exploratory_testing', prerequisites: ['manual_testing'], name: 'Exploratory Testing', desc: 'Unscripted testing approach', benefit: 'Discovery of unexpected issues' },
        'usability_testing': { id: 'usability_testing', prerequisites: ['manual_testing'], name: 'Usability Testing', desc: 'User experience validation', benefit: 'Improved user satisfaction' },
        
        'test_automation': { id: 'test_automation', prerequisites: ['test_design'], name: 'Test Automation', desc: 'Automated testing concepts', benefit: 'Efficient regression testing' },
        'selenium': { id: 'selenium', prerequisites: ['test_automation'], name: 'Selenium', desc: 'Web automation framework', benefit: 'Browser automation' },
        'cypress': { id: 'cypress', prerequisites: ['test_automation'], name: 'Cypress', desc: 'Modern testing framework', benefit: 'Fast end-to-end testing' },
        'playwright': { id: 'playwright', prerequisites: ['selenium'], name: 'Playwright', desc: 'Cross-browser automation', benefit: 'Multi-browser testing' },
        
        'api_testing': { id: 'api_testing', prerequisites: ['test_design'], name: 'API Testing', desc: 'Service layer testing', benefit: 'Backend validation' },
        'postman': { id: 'postman', prerequisites: ['api_testing'], name: 'Postman', desc: 'API testing tool', benefit: 'API development workflow' },
        'rest_assured': { id: 'rest_assured', prerequisites: ['api_testing'], name: 'REST Assured', desc: 'Java API testing', benefit: 'Automated API validation' },
        
        'performance_testing': { id: 'performance_testing', prerequisites: ['test_automation'], name: 'Performance Testing', desc: 'System performance validation', benefit: 'Scalability assurance' },
        'jmeter': { id: 'jmeter', prerequisites: ['performance_testing'], name: 'JMeter', desc: 'Load testing tool', benefit: 'Performance bottleneck identification' },
        'k6': { id: 'k6', prerequisites: ['performance_testing'], name: 'K6', desc: 'Modern load testing', benefit: 'Developer-friendly performance testing' },
        
        'security_testing': { id: 'security_testing', prerequisites: ['api_testing'], name: 'Security Testing', desc: 'Application security validation', benefit: 'Vulnerability identification' },
        'owasp': { id: 'owasp', prerequisites: ['security_testing'], name: 'OWASP', desc: 'Security testing standards', benefit: 'Security best practices' },
        'burp_suite': { id: 'burp_suite', prerequisites: ['security_testing'], name: 'Burp Suite', desc: 'Security testing platform', benefit: 'Web application security testing' },
        
        'mobile_testing': { id: 'mobile_testing', prerequisites: ['test_automation'], name: 'Mobile Testing', desc: 'Mobile application testing', benefit: 'Mobile quality assurance' },
        'appium': { id: 'appium', prerequisites: ['mobile_testing'], name: 'Appium', desc: 'Mobile automation framework', benefit: 'Cross-platform mobile testing' },
        'espresso': { id: 'espresso', prerequisites: ['mobile_testing'], name: 'Espresso', desc: 'Android testing framework', benefit: 'Native Android testing' },
        
        'ci_cd_testing': { id: 'ci_cd_testing', prerequisites: ['test_automation'], name: 'CI/CD Testing', desc: 'Continuous testing integration', benefit: 'Automated quality gates' },
        'jenkins': { id: 'jenkins', prerequisites: ['ci_cd_testing'], name: 'Jenkins', desc: 'CI/CD automation', benefit: 'Continuous integration' },
        'github_actions': { id: 'github_actions', prerequisites: ['ci_cd_testing'], name: 'GitHub Actions', desc: 'GitHub CI/CD', benefit: 'Integrated testing workflows' },
        
        'test_management': { id: 'test_management', prerequisites: ['test_planning'], name: 'Test Management', desc: 'Test process management', benefit: 'Organized testing lifecycle' },
        'jira': { id: 'jira', prerequisites: ['test_management'], name: 'Jira', desc: 'Project management tool', benefit: 'Test case management' },
        'testlink': { id: 'testlink', prerequisites: ['test_management'], name: 'TestLink', desc: 'Test management system', benefit: 'Test execution tracking' },
        
        'bug_tracking': { id: 'bug_tracking', prerequisites: ['manual_testing'], name: 'Bug Tracking', desc: 'Defect management', benefit: 'Issue resolution workflow' },
        'bugzilla': { id: 'bugzilla', prerequisites: ['bug_tracking'], name: 'Bugzilla', desc: 'Bug tracking system', benefit: 'Defect lifecycle management' },
        'mantis': { id: 'mantis', prerequisites: ['bug_tracking'], name: 'Mantis', desc: 'Issue tracking tool', benefit: 'Bug reporting and tracking' }
    },
    'data-analyst': {
        'statistics': { id: 'statistics', prerequisites: [], name: 'Statistics', desc: 'Statistical analysis fundamentals', benefit: 'Data interpretation skills' },
        'probability': { id: 'probability', prerequisites: ['statistics'], name: 'Probability', desc: 'Probability theory', benefit: 'Uncertainty quantification' },
        'descriptive_stats': { id: 'descriptive_stats', prerequisites: ['statistics'], name: 'Descriptive Statistics', desc: 'Data summarization techniques', benefit: 'Data understanding' },
        'inferential_stats': { id: 'inferential_stats', prerequisites: ['probability'], name: 'Inferential Statistics', desc: 'Population inference from samples', benefit: 'Statistical conclusions' },
        'hypothesis_testing': { id: 'hypothesis_testing', prerequisites: ['inferential_stats'], name: 'Hypothesis Testing', desc: 'Statistical hypothesis validation', benefit: 'Evidence-based decisions' },
        
        'excel': { id: 'excel', prerequisites: [], name: 'Excel', desc: 'Spreadsheet analysis tool', benefit: 'Basic data manipulation' },
        'pivot_tables': { id: 'pivot_tables', prerequisites: ['excel'], name: 'Pivot Tables', desc: 'Data summarization in Excel', benefit: 'Quick data insights' },
        'vlookup': { id: 'vlookup', prerequisites: ['excel'], name: 'VLOOKUP/HLOOKUP', desc: 'Data lookup functions', benefit: 'Data relationship analysis' },
        
        'sql': { id: 'sql', prerequisites: [], name: 'SQL', desc: 'Database query language', benefit: 'Data extraction and manipulation' },
        'joins': { id: 'joins', prerequisites: ['sql'], name: 'SQL Joins', desc: 'Table relationship queries', benefit: 'Complex data retrieval' },
        'window_functions': { id: 'window_functions', prerequisites: ['joins'], name: 'Window Functions', desc: 'Advanced SQL analytics', benefit: 'Sophisticated data analysis' },
        'stored_procedures': { id: 'stored_procedures', prerequisites: ['window_functions'], name: 'Stored Procedures', desc: 'Reusable SQL code', benefit: 'Automated data processing' },
        
        'python': { id: 'python', prerequisites: [], name: 'Python', desc: 'Programming language for data analysis', benefit: 'Flexible data manipulation' },
        'pandas': { id: 'pandas', prerequisites: ['python'], name: 'Pandas', desc: 'Data manipulation library', benefit: 'Efficient data processing' },
        'numpy': { id: 'numpy', prerequisites: ['python'], name: 'NumPy', desc: 'Numerical computing library', benefit: 'Mathematical operations' },
        'matplotlib': { id: 'matplotlib', prerequisites: ['pandas'], name: 'Matplotlib', desc: 'Data visualization library', benefit: 'Statistical plotting' },
        'seaborn': { id: 'seaborn', prerequisites: ['matplotlib'], name: 'Seaborn', desc: 'Statistical visualization', benefit: 'Beautiful statistical plots' },
        'plotly': { id: 'plotly', prerequisites: ['matplotlib'], name: 'Plotly', desc: 'Interactive visualizations', benefit: 'Dynamic data exploration' },
        
        'r': { id: 'r', prerequisites: [], name: 'R', desc: 'Statistical programming language', benefit: 'Advanced statistical analysis' },
        'ggplot2': { id: 'ggplot2', prerequisites: ['r'], name: 'ggplot2', desc: 'Grammar of graphics', benefit: 'Elegant data visualization' },
        'dplyr': { id: 'dplyr', prerequisites: ['r'], name: 'dplyr', desc: 'Data manipulation in R', benefit: 'Efficient data transformation' },
        
        'tableau': { id: 'tableau', prerequisites: [], name: 'Tableau', desc: 'Business intelligence tool', benefit: 'Interactive dashboards' },
        'power_bi': { id: 'power_bi', prerequisites: [], name: 'Power BI', desc: 'Microsoft BI platform', benefit: 'Business analytics' },
        'looker': { id: 'looker', prerequisites: [], name: 'Looker', desc: 'Modern BI platform', benefit: 'Self-service analytics' },
        'qlik': { id: 'qlik', prerequisites: [], name: 'QlikView/Sense', desc: 'Associative analytics', benefit: 'Exploratory data analysis' },
        
        'data_cleaning': { id: 'data_cleaning', prerequisites: ['pandas'], name: 'Data Cleaning', desc: 'Data quality improvement', benefit: 'Reliable analysis foundation' },
        'data_transformation': { id: 'data_transformation', prerequisites: ['data_cleaning'], name: 'Data Transformation', desc: 'Data structure modification', benefit: 'Analysis-ready datasets' },
        'feature_engineering': { id: 'feature_engineering', prerequisites: ['data_transformation'], name: 'Feature Engineering', desc: 'Variable creation and selection', benefit: 'Enhanced model performance' },
        
        'regression_analysis': { id: 'regression_analysis', prerequisites: ['hypothesis_testing'], name: 'Regression Analysis', desc: 'Relationship modeling', benefit: 'Predictive insights' },
        'time_series': { id: 'time_series', prerequisites: ['regression_analysis'], name: 'Time Series Analysis', desc: 'Temporal data analysis', benefit: 'Trend and seasonality insights' },
        'clustering': { id: 'clustering', prerequisites: ['feature_engineering'], name: 'Clustering', desc: 'Unsupervised grouping', benefit: 'Pattern discovery' },
        'machine_learning': { id: 'machine_learning', prerequisites: ['time_series', 'clustering'], name: 'Machine Learning', desc: 'Predictive modeling', benefit: 'Automated insights' }
    },
    'ios': {
        'swift': { id: 'swift', prerequisites: [], name: 'Swift', desc: 'iOS programming language', benefit: 'Native iOS development' },
        'objective_c': { id: 'objective_c', prerequisites: [], name: 'Objective-C', desc: 'Legacy iOS language', benefit: 'Legacy code maintenance' },
        'xcode': { id: 'xcode', prerequisites: ['swift'], name: 'Xcode', desc: 'iOS development environment', benefit: 'Integrated development workflow' },
        
        'ios_fundamentals': { id: 'ios_fundamentals', prerequisites: ['xcode'], name: 'iOS Fundamentals', desc: 'Core iOS concepts', benefit: 'Platform understanding' },
        'app_lifecycle': { id: 'app_lifecycle', prerequisites: ['ios_fundamentals'], name: 'App Lifecycle', desc: 'Application state management', benefit: 'Proper app behavior' },
        'view_controller': { id: 'view_controller', prerequisites: ['ios_fundamentals'], name: 'View Controllers', desc: 'Screen management', benefit: 'UI flow control' },
        
        'uikit': { id: 'uikit', prerequisites: ['xcode'], name: 'UIKit', desc: 'iOS UI framework', benefit: 'Native user interfaces' },
        'auto_layout': { id: 'auto_layout', prerequisites: ['uikit'], name: 'Auto Layout', desc: 'Responsive UI design', benefit: 'Multi-device compatibility' },
        'storyboards': { id: 'storyboards', prerequisites: ['uikit'], name: 'Storyboards', desc: 'Visual UI design', benefit: 'Rapid prototyping' },
        'xibs': { id: 'xibs', prerequisites: ['storyboards'], name: 'XIBs', desc: 'Interface Builder files', benefit: 'Reusable UI components' },
        
        'swiftui': { id: 'swiftui', prerequisites: ['swift'], name: 'SwiftUI', desc: 'Declarative UI framework', benefit: 'Modern UI development' },
        'combine': { id: 'combine', prerequisites: ['swiftui'], name: 'Combine', desc: 'Reactive programming', benefit: 'Asynchronous data handling' },
        
        'navigation': { id: 'navigation', prerequisites: ['view_controller'], name: 'Navigation', desc: 'App navigation patterns', benefit: 'User flow management' },
        'tab_bar': { id: 'tab_bar', prerequisites: ['navigation'], name: 'Tab Bar Controller', desc: 'Tab-based navigation', benefit: 'Multi-section apps' },
        'navigation_controller': { id: 'navigation_controller', prerequisites: ['navigation'], name: 'Navigation Controller', desc: 'Hierarchical navigation', benefit: 'Drill-down interfaces' },
        
        'table_views': { id: 'table_views', prerequisites: ['auto_layout'], name: 'Table Views', desc: 'List-based interfaces', benefit: 'Data presentation' },
        'collection_views': { id: 'collection_views', prerequisites: ['table_views'], name: 'Collection Views', desc: 'Grid-based layouts', benefit: 'Flexible data display' },
        'custom_cells': { id: 'custom_cells', prerequisites: ['collection_views'], name: 'Custom Cells', desc: 'Custom table/collection cells', benefit: 'Tailored data presentation' },
        
        'core_data': { id: 'core_data', prerequisites: ['ios_fundamentals'], name: 'Core Data', desc: 'Data persistence framework', benefit: 'Local data storage' },
        'user_defaults': { id: 'user_defaults', prerequisites: ['ios_fundamentals'], name: 'UserDefaults', desc: 'Simple data storage', benefit: 'Settings persistence' },
        'keychain': { id: 'keychain', prerequisites: ['ios_fundamentals'], name: 'Keychain', desc: 'Secure data storage', benefit: 'Credential security' },
        
        'networking': { id: 'networking', prerequisites: ['ios_fundamentals'], name: 'Networking', desc: 'HTTP communication', benefit: 'Server integration' },
        'urlsession': { id: 'urlsession', prerequisites: ['networking'], name: 'URLSession', desc: 'Network request handling', benefit: 'API communication' },
        'alamofire': { id: 'alamofire', prerequisites: ['networking'], name: 'Alamofire', desc: 'HTTP networking library', benefit: 'Simplified networking' },
        
        'json_parsing': { id: 'json_parsing', prerequisites: ['networking'], name: 'JSON Parsing', desc: 'Data serialization', benefit: 'API data handling' },
        'codable': { id: 'codable', prerequisites: ['json_parsing'], name: 'Codable', desc: 'Swift serialization protocol', benefit: 'Type-safe data parsing' },
        
        'testing': { id: 'testing', prerequisites: ['swiftui'], name: 'Testing', desc: 'Unit and UI testing', benefit: 'Code quality assurance' },
        'xctest': { id: 'xctest', prerequisites: ['testing'], name: 'XCTest', desc: 'Testing framework', benefit: 'Automated testing' },
        'ui_testing': { id: 'ui_testing', prerequisites: ['testing'], name: 'UI Testing', desc: 'User interface testing', benefit: 'End-to-end validation' },
        
        'app_store': { id: 'app_store', prerequisites: ['testing'], name: 'App Store', desc: 'App distribution', benefit: 'App publishing' },
        'provisioning': { id: 'provisioning', prerequisites: ['app_store'], name: 'Provisioning', desc: 'Code signing and certificates', benefit: 'App deployment' },
        'testflight': { id: 'testflight', prerequisites: ['app_store'], name: 'TestFlight', desc: 'Beta testing platform', benefit: 'Pre-release testing' }
    },
    'android': {
        'kotlin': { id: 'kotlin', prerequisites: [], name: 'Kotlin', desc: 'Modern Android language', benefit: 'Concise Android development' },
        'java': { id: 'java', prerequisites: [], name: 'Java', desc: 'Traditional Android language', benefit: 'Legacy Android development' },
        'android_studio': { id: 'android_studio', prerequisites: ['kotlin'], name: 'Android Studio', desc: 'Android development IDE', benefit: 'Integrated development environment' },
        
        'android_fundamentals': { id: 'android_fundamentals', prerequisites: ['android_studio'], name: 'Android Fundamentals', desc: 'Core Android concepts', benefit: 'Platform understanding' },
        'activities': { id: 'activities', prerequisites: ['android_fundamentals'], name: 'Activities', desc: 'Screen components', benefit: 'UI screen management' },
        'fragments': { id: 'fragments', prerequisites: ['android_fundamentals'], name: 'Fragments', desc: 'Reusable UI components', benefit: 'Modular UI design' },
        'services': { id: 'services', prerequisites: ['activities'], name: 'Services', desc: 'Background processing', benefit: 'Long-running operations' },
        
        'layouts': { id: 'layouts', prerequisites: ['android_studio'], name: 'Layouts', desc: 'UI layout systems', benefit: 'Structured user interfaces' },
        'linear_layout': { id: 'linear_layout', prerequisites: ['layouts'], name: 'LinearLayout', desc: 'Sequential layout', benefit: 'Simple UI arrangements' },
        'relative_layout': { id: 'relative_layout', prerequisites: ['layouts'], name: 'RelativeLayout', desc: 'Relative positioning', benefit: 'Flexible UI positioning' },
        'constraint_layout': { id: 'constraint_layout', prerequisites: ['relative_layout'], name: 'ConstraintLayout', desc: 'Constraint-based layout', benefit: 'Responsive UI design' },
        
        'jetpack_compose': { id: 'jetpack_compose', prerequisites: ['kotlin'], name: 'Jetpack Compose', desc: 'Modern UI toolkit', benefit: 'Declarative UI development' },
        'compose_ui': { id: 'compose_ui', prerequisites: ['jetpack_compose'], name: 'Compose UI', desc: 'Composable functions', benefit: 'Reactive UI components' },
        'compose_navigation': { id: 'compose_navigation', prerequisites: ['jetpack_compose'], name: 'Compose Navigation', desc: 'Navigation in Compose', benefit: 'Modern navigation patterns' },
        
        'intents': { id: 'intents', prerequisites: ['services'], name: 'Intents', desc: 'Component communication', benefit: 'Inter-component messaging' },
        'broadcast_receivers': { id: 'broadcast_receivers', prerequisites: ['intents'], name: 'Broadcast Receivers', desc: 'System event handling', benefit: 'System integration' },
        'content_providers': { id: 'content_providers', prerequisites: ['broadcast_receivers'], name: 'Content Providers', desc: 'Data sharing', benefit: 'Inter-app data access' },
        
        'recyclerview': { id: 'recyclerview', prerequisites: ['constraint_layout'], name: 'RecyclerView', desc: 'Efficient list display', benefit: 'Performance list rendering' },
        'viewpager': { id: 'viewpager', prerequisites: ['recyclerview'], name: 'ViewPager', desc: 'Swipeable views', benefit: 'Tab-like interfaces' },
        'cardview': { id: 'cardview', prerequisites: ['recyclerview'], name: 'CardView', desc: 'Material design cards', benefit: 'Modern UI components' },
        
        'room_database': { id: 'room_database', prerequisites: ['android_fundamentals'], name: 'Room Database', desc: 'Local database solution', benefit: 'Type-safe database access' },
        'shared_preferences': { id: 'shared_preferences', prerequisites: ['android_fundamentals'], name: 'SharedPreferences', desc: 'Simple data storage', benefit: 'Settings persistence' },
        'datastore': { id: 'datastore', prerequisites: ['shared_preferences'], name: 'DataStore', desc: 'Modern data storage', benefit: 'Asynchronous data storage' },
        
        'retrofit': { id: 'retrofit', prerequisites: ['android_fundamentals'], name: 'Retrofit', desc: 'HTTP client library', benefit: 'Type-safe API calls' },
        'okhttp': { id: 'okhttp', prerequisites: ['retrofit'], name: 'OkHttp', desc: 'HTTP client', benefit: 'Efficient networking' },
        'gson': { id: 'gson', prerequisites: ['retrofit'], name: 'Gson', desc: 'JSON serialization', benefit: 'Object-JSON conversion' },
        
        'mvvm': { id: 'mvvm', prerequisites: ['jetpack_compose'], name: 'MVVM', desc: 'Architecture pattern', benefit: 'Separation of concerns' },
        'viewmodel': { id: 'viewmodel', prerequisites: ['mvvm'], name: 'ViewModel', desc: 'UI state management', benefit: 'Configuration change survival' },
        'livedata': { id: 'livedata', prerequisites: ['mvvm'], name: 'LiveData', desc: 'Observable data holder', benefit: 'Lifecycle-aware data' },
        
        'testing': { id: 'testing', prerequisites: ['jetpack_compose'], name: 'Testing', desc: 'Unit and UI testing', benefit: 'Code quality assurance' },
        'junit': { id: 'junit', prerequisites: ['testing'], name: 'JUnit', desc: 'Unit testing framework', benefit: 'Automated testing' },
        'espresso': { id: 'espresso', prerequisites: ['testing'], name: 'Espresso', desc: 'UI testing framework', benefit: 'Android UI testing' },
        
        'google_play': { id: 'google_play', prerequisites: ['testing'], name: 'Google Play', desc: 'App distribution', benefit: 'App publishing' },
        'app_signing': { id: 'app_signing', prerequisites: ['google_play'], name: 'App Signing', desc: 'Application security', benefit: 'Secure app distribution' },
        'play_console': { id: 'play_console', prerequisites: ['google_play'], name: 'Play Console', desc: 'App management platform', benefit: 'App lifecycle management' }
    },
    'ux-design': {
        'design_thinking': { id: 'design_thinking', prerequisites: [], name: 'Design Thinking', desc: 'Human-centered design process', benefit: 'User-focused solutions' },
        'user_research': { id: 'user_research', prerequisites: ['design_thinking'], name: 'User Research', desc: 'Understanding user needs', benefit: 'Evidence-based design decisions' },
        'personas': { id: 'personas', prerequisites: ['user_research'], name: 'Personas', desc: 'User archetype creation', benefit: 'Targeted design approach' },
        'user_journey': { id: 'user_journey', prerequisites: ['user_research'], name: 'User Journey Mapping', desc: 'User experience visualization', benefit: 'Holistic experience understanding' },
        
        'information_architecture': { id: 'information_architecture', prerequisites: ['design_thinking'], name: 'Information Architecture', desc: 'Content organization', benefit: 'Logical content structure' },
        'site_mapping': { id: 'site_mapping', prerequisites: ['information_architecture'], name: 'Site Mapping', desc: 'Website structure planning', benefit: 'Clear navigation hierarchy' },
        'card_sorting': { id: 'card_sorting', prerequisites: ['information_architecture'], name: 'Card Sorting', desc: 'Content categorization method', benefit: 'User-driven organization' },
        
        'wireframing': { id: 'wireframing', prerequisites: ['personas'], name: 'Wireframing', desc: 'Low-fidelity design layouts', benefit: 'Rapid concept validation' },
        'low_fidelity': { id: 'low_fidelity', prerequisites: ['wireframing'], name: 'Low-Fidelity Prototypes', desc: 'Basic interactive mockups', benefit: 'Quick concept testing' },
        'high_fidelity': { id: 'high_fidelity', prerequisites: ['low_fidelity'], name: 'High-Fidelity Prototypes', desc: 'Detailed interactive designs', benefit: 'Realistic user testing' },
        
        'prototyping': { id: 'prototyping', prerequisites: ['user_journey'], name: 'Prototyping', desc: 'Interactive design creation', benefit: 'User experience validation' },
        'figma': { id: 'figma', prerequisites: ['prototyping'], name: 'Figma', desc: 'Collaborative design tool', benefit: 'Team design workflow' },
        'sketch': { id: 'sketch', prerequisites: ['prototyping'], name: 'Sketch', desc: 'Vector design tool', benefit: 'Professional design creation' },
        'adobe_xd': { id: 'adobe_xd', prerequisites: ['figma'], name: 'Adobe XD', desc: 'Design and prototyping tool', benefit: 'Integrated design workflow' },
        
        'visual_design': { id: 'visual_design', prerequisites: ['prototyping'], name: 'Visual Design', desc: 'Aesthetic design principles', benefit: 'Appealing user interfaces' },
        'color_theory': { id: 'color_theory', prerequisites: ['visual_design'], name: 'Color Theory', desc: 'Color psychology and harmony', benefit: 'Effective color usage' },
        'typography': { id: 'typography', prerequisites: ['visual_design'], name: 'Typography', desc: 'Text design and readability', benefit: 'Clear communication' },
        'layout_principles': { id: 'layout_principles', prerequisites: ['color_theory', 'typography'], name: 'Layout Principles', desc: 'Visual hierarchy and composition', benefit: 'Organized information presentation' },
        
        'usability_testing': { id: 'usability_testing', prerequisites: ['high_fidelity'], name: 'Usability Testing', desc: 'User experience validation', benefit: 'Evidence-based improvements' },
        'a_b_testing': { id: 'a_b_testing', prerequisites: ['usability_testing'], name: 'A/B Testing', desc: 'Comparative design testing', benefit: 'Data-driven design decisions' },
        'user_interviews': { id: 'user_interviews', prerequisites: ['usability_testing'], name: 'User Interviews', desc: 'Qualitative user feedback', benefit: 'Deep user insights' },
        
        'interaction_design': { id: 'interaction_design', prerequisites: ['adobe_xd'], name: 'Interaction Design', desc: 'User interface behavior design', benefit: 'Intuitive user interactions' },
        'micro_interactions': { id: 'micro_interactions', prerequisites: ['interaction_design'], name: 'Micro-interactions', desc: 'Small interactive details', benefit: 'Enhanced user engagement' },
        'animation': { id: 'animation', prerequisites: ['interaction_design'], name: 'Animation', desc: 'Motion design for interfaces', benefit: 'Smooth user experience' },
        
        'design_systems': { id: 'design_systems', prerequisites: ['layout_principles'], name: 'Design Systems', desc: 'Consistent design standards', benefit: 'Scalable design consistency' },
        'component_library': { id: 'component_library', prerequisites: ['design_systems'], name: 'Component Library', desc: 'Reusable design components', benefit: 'Efficient design workflow' },
        'style_guides': { id: 'style_guides', prerequisites: ['design_systems'], name: 'Style Guides', desc: 'Design documentation', benefit: 'Design consistency maintenance' },
        
        'accessibility': { id: 'accessibility', prerequisites: ['user_interviews'], name: 'Accessibility', desc: 'Inclusive design practices', benefit: 'Universal usability' },
        'wcag': { id: 'wcag', prerequisites: ['accessibility'], name: 'WCAG Guidelines', desc: 'Web accessibility standards', benefit: 'Compliant accessible design' },
        'screen_readers': { id: 'screen_readers', prerequisites: ['accessibility'], name: 'Screen Reader Testing', desc: 'Assistive technology validation', benefit: 'Verified accessibility' },
        
        'mobile_design': { id: 'mobile_design', prerequisites: ['animation'], name: 'Mobile Design', desc: 'Mobile-first design approach', benefit: 'Optimized mobile experiences' },
        'responsive_design': { id: 'responsive_design', prerequisites: ['mobile_design'], name: 'Responsive Design', desc: 'Multi-device compatibility', benefit: 'Universal device support' },
        'touch_interfaces': { id: 'touch_interfaces', prerequisites: ['mobile_design'], name: 'Touch Interfaces', desc: 'Touch-optimized interactions', benefit: 'Natural mobile interactions' },
        
        'ux_metrics': { id: 'ux_metrics', prerequisites: ['style_guides'], name: 'UX Metrics', desc: 'User experience measurement', benefit: 'Quantified design impact' },
        'analytics': { id: 'analytics', prerequisites: ['ux_metrics'], name: 'Analytics', desc: 'User behavior analysis', benefit: 'Data-driven insights' },
        'conversion_optimization': { id: 'conversion_optimization', prerequisites: ['ux_metrics'], name: 'Conversion Optimization', desc: 'Goal achievement improvement', benefit: 'Business objective alignment' }
    }
};

Object.keys(HARD_SKILLS_DATA).forEach(area => {
  autoLayoutCompactDAG(HARD_SKILLS_DATA[area], { r: 50, minSep: 120, layerGap: 160 });
});

let currentSkillTreeData = {};
let skillTreeState = {
    softSkills: {
        mastered: [],
        selected: []
    },
    hardSkills: {
        mastered: [],
        selected: []
    },
    competencyArea: 'backend'
};

function checkAuth() {
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('user_info');
    
    const urlParams = new URLSearchParams(window.location.search);
    const employeeToken = urlParams.get('token');
    
    if (employeeToken) {
        isEmployeeView = true;
        return employeeToken;
    }
    
    if (!token || !user) {
        window.location.href = '/login';
        return false;
    }
    
    const userInfo = JSON.parse(user);
    document.getElementById('userName').textContent = userInfo.name;
    return token;
}

function getEmployeeIdFromUrl() {
    const path = window.location.pathname;
    const matches = path.match(/\/employee\/([a-f0-9-]+)/);
    return matches ? matches[1] : null;
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
        type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
        'bg-red-50 border border-red-200 text-red-800'
    }`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function getInitials(name) {
    if (!name) return '??';
    return name.split(' ')
        .map(word => word.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('');
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
}

async function loadEmployeeProfile() {
    const token = checkAuth();
    if (!token) return;

    employeeId = getEmployeeIdFromUrl();
    if (!employeeId) {
        showToast('Неверный ID сотрудника', 'error');
        return;
    }

    try {
        const endpoint = isEmployeeView ? 
            `/api/employee/${employeeId}/profile?token=${token}` : 
            `/api/employee/${employeeId}`;
            
        const headers = isEmployeeView ? {} : {
            'Authorization': `Bearer ${token}`
        };

        const response = await fetch(endpoint, { headers });
        
        if (!response.ok) {
            throw new Error('Не удалось загрузить профиль сотрудника');
        }

        currentEmployee = await response.json();
        displayEmployeeProfile(currentEmployee);
        window.currentEmployee = currentEmployee;

        
    } catch (error) {
        console.error('Error loading employee profile:', error);
        showToast('Ошибка загрузки профиля сотрудника', 'error');
    } finally {
        document.getElementById('loadingIndicator').classList.add('hidden');
    }
}

function displayEmployeeProfile(employee) {
    document.getElementById('employeeName').textContent = employee.name || 'Имя не указано';
    document.getElementById('employeePosition').textContent = employee.position || 'Должность не указана';
    document.getElementById('employeeTeam').textContent = employee.team_name || 'Без команды';
    document.getElementById('employeeEmail').textContent = employee.email || '';
    document.getElementById('employeePhone').textContent = employee.phone || '';
    document.getElementById('employeeHireDate').textContent = employee.hire_date ? 
        `Принят: ${formatDate(employee.hire_date)}` : '';

    const initials = getInitials(employee.name);
    document.getElementById('employeeInitials').textContent = initials;

    document.getElementById('basicName').textContent = employee.name || '-';
    document.getElementById('basicEmail').textContent = employee.email || '-';
    document.getElementById('basicPosition').textContent = employee.position || '-';
    document.getElementById('basicTeamName').textContent = employee.team_name || 'Без команды';
    document.getElementById('basicPhone').textContent = employee.phone || '-';
    document.getElementById('basicHireDate').textContent = formatDate(employee.hire_date);

    displayOkrGoals(employee.okr_goals || []);

    displayDiscPersonality(employee.disc_type, employee.disc_data);

    displayDevelopmentPlan(employee.development_plan || []);

    document.getElementById('roles').textContent = employee.roles || '-';
    document.getElementById('timeZone').textContent = employee.time_zone || '-';
    document.getElementById('domains').textContent = employee.domains || '-';
    document.getElementById('expertise').textContent = employee.expertise || '-';
    document.getElementById('personalInterests').textContent = employee.personal_interests || '-';
    document.getElementById('stakeholders').textContent = employee.stakeholders || '-';
    document.getElementById('importantTraits').textContent = employee.important_traits || '-';

    document.getElementById('commChannels').textContent = employee.comm_channels || '-';
    document.getElementById('meetingTimes').textContent = employee.meeting_times || '-';
    document.getElementById('commStyle').textContent = employee.comm_style || '-';

    document.getElementById('workStyle').textContent = employee.work_style || '-';
    document.getElementById('motivators').textContent = employee.motivators || '-';
    document.getElementById('demotivators').textContent = employee.demotivators || '-';

    if (window.translationManager && window.translationManager.translations && 
        (window.translationManager.translations.ru || window.translationManager.translations.en)) {
        initializeMotivationalTriggers();
        setupWorkspaceDropZone();
    } else {
        setTimeout(() => {
            initializeMotivationalTriggers();
            setupWorkspaceDropZone();
        }, 500);
    }

    if (isEmployeeView) {
        document.getElementById('shareProfileBtn').style.display = 'none';
    }
}

function displayOkrGoals(goals) {
    const container = document.getElementById('okrContent');
    
    if (!goals || goals.length === 0) {
        container.innerHTML = `
            <div class="text-gray-500 text-center py-8" data-translate="employee.no_okr_goals">
                OKR цели не установлены
            </div>
        `;
        return;
    }

    container.innerHTML = goals.map((goal, goalIndex) => {
        const progress = calculateOkrProgress(goal);
        const timeRemaining = calculateTimeRemaining(goal.deadline);
        const isOverdue = timeRemaining.isOverdue;
        
        return `
            <div class="border border-gray-200 rounded-lg p-4 mb-4">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center space-x-2">
                        <input type="checkbox" 
                               id="objective-${goalIndex}" 
                               ${goal.completed ? 'checked' : ''} 
                               onchange="toggleOkrCompletion(${goalIndex}, 'objective')"
                               class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                        <h4 class="font-medium text-gray-900 ${goal.completed ? 'line-through text-gray-500' : ''}">${goal.objective || 'Цель не указана'}</h4>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span class="text-xs px-2 py-1 rounded-full ${
                            goal.completed ? 'bg-green-100 text-green-800' :
                            goal.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                            isOverdue ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                        }" data-translate="employee.okr_${goal.completed ? 'completed' : goal.status || 'not_started'}">
                            ${goal.completed ? 'Выполнено' :
                              goal.status === 'in_progress' ? 'В процессе' : 
                              isOverdue ? 'Просрочено' : 'Не начато'}
                        </span>
                        <button onclick="editOkr(${goalIndex})" class="text-blue-600 hover:text-blue-800 text-sm">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                        </button>
                        <button onclick="deleteOkr(${goalIndex})" class="text-red-600 hover:text-red-800 text-sm">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                
                <!-- Progress Bar -->
                <div class="mb-3">
                    <div class="flex justify-between text-sm text-gray-600 mb-1">
                        <span data-translate="employee.okr_progress">Прогресс</span>
                        <span>${progress}%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
                    </div>
                </div>
                
                <!-- Time Remaining -->
                ${goal.deadline ? `
                    <div class="mb-3 text-sm ${isOverdue ? 'text-red-600' : 'text-gray-600'}">
                        <span data-translate="employee.okr_time_remaining">Осталось времени</span>: 
                        ${isOverdue ? 
                            `<span class="font-medium" data-translate="employee.okr_overdue">Просрочено</span>` :
                            `<span class="font-medium">${timeRemaining.days} <span data-translate="employee.okr_days">дней</span></span>`
                        }
                        <span class="text-gray-400 ml-2">до ${formatDate(goal.deadline)}</span>
                    </div>
                ` : ''}
                
                <!-- Key Results -->
                ${goal.key_results && goal.key_results.length > 0 ? `
                    <div class="space-y-2">
                        <p class="text-sm font-medium text-gray-700">Ключевые результаты:</p>
                        <ul class="space-y-2">
                            ${goal.key_results.map((kr, krIndex) => `
                                <li class="flex items-center space-x-2 text-sm">
                                    <input type="checkbox" 
                                           id="kr-${goalIndex}-${krIndex}" 
                                           ${goal.key_results_completed && goal.key_results_completed[krIndex] ? 'checked' : ''} 
                                           onchange="toggleOkrCompletion(${goalIndex}, 'key_result', ${krIndex})"
                                           class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                                    <span class="${goal.key_results_completed && goal.key_results_completed[krIndex] ? 'line-through text-gray-500' : 'text-gray-600'}">${kr}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function displayDiscPersonality(discType, discData) {
    const typeElement = document.getElementById('discType');
    const descriptionElement = document.getElementById('discDescription');
    const detailsElement = document.getElementById('discDetails');

    if (!discType) {
        typeElement.textContent = '?';
        descriptionElement.textContent = 'Тип личности не определен';
        detailsElement.classList.add('hidden');
        return;
    }

    typeElement.textContent = discType.toUpperCase();
    
    const discDescriptions = {
        'D': 'Соратник - Прямой, решительный, ориентированный на результат',
        'I': 'Энтузиаст - Общительный, оптимистичный, вдохновляющий',
        'S': 'Миротворец - Терпеливый, надежный, поддерживающий',
        'C': 'Аналитик - Аналитический, точный, систематичный',
        'DI': 'Вдохновитель - Энергичный лидер, мотивирующий других',
        'DS': 'Организатор - Решительный и стабильный исполнитель',
        'DC': 'Организатор - Требовательный и систематичный лидер',
        'IS': 'Связной - Дружелюбный и поддерживающий коммуникатор',
        'IC': 'Связной - Влиятельный и детально-ориентированный',
        'SC': 'Координатор - Терпеливый и методичный исполнитель'
    };

    descriptionElement.textContent = discDescriptions[discType.toUpperCase()] || 'Описание недоступно';

    if (discData) {
        document.getElementById('discStrengths').textContent = discData.strengths || '-';
        document.getElementById('discChallenges').textContent = discData.challenges || '-';
        document.getElementById('discCommunication').textContent = discData.communication || '-';
        detailsElement.classList.remove('hidden');
    } else {
        detailsElement.classList.add('hidden');
    }
}

function displayDevelopmentPlan(plan) {
    const container = document.getElementById('developmentContent');
    
    if (!plan || (!plan.softSkills && !plan.hardSkills && plan.length === 0)) {
        container.innerHTML = `
            <div class="text-gray-500 text-center py-8" data-translate="employee.no_development_plan">
                План развития не создан
            </div>
        `;
        return;
    }

    if (plan.softSkills || plan.hardSkills) {
        const softSkills = plan.softSkills || {};
        const hardSkills = plan.hardSkills || {};
        
        container.innerHTML = `
            <div class="space-y-6">
                ${softSkills.selected && softSkills.selected.length > 0 ? `
                    <div class="border border-gray-200 rounded-lg p-4">
                        <h4 class="font-medium text-gray-900 mb-3" data-translate="soft_skills">Софт скиллы</h4>
                        <div class="space-y-2">
                            ${softSkills.selected.map(skillId => {
                                const skill = SOFT_SKILLS_DATA[skillId];
                                const skillName = skill ? (window.translationManager ? window.translationManager.t(skill.nameKey) : skill.nameKey) : skillId;
                                const isMastered = softSkills.mastered && softSkills.mastered.includes(skillId);
                                return `
                                    <div class="flex items-center justify-between p-2 bg-blue-50 rounded">
                                        <span class="text-sm font-medium text-blue-900">${skillName}</span>
                                        <span class="text-xs px-2 py-1 rounded-full ${isMastered ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}">
                                            ${isMastered ? 'Освоен' : 'В развитии'}
                                        </span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}
                ${hardSkills.selected && hardSkills.selected.length > 0 ? `
                    <div class="border border-gray-200 rounded-lg p-4">
                        <h4 class="font-medium text-gray-900 mb-3" data-translate="hard_skills">Хард скиллы</h4>
                        <div class="space-y-2">
                            ${hardSkills.selected.map(skillId => {
                                const competencyArea = hardSkills.competencyArea || 'backend';
                                const skill = HARD_SKILLS_DATA[competencyArea] && HARD_SKILLS_DATA[competencyArea][skillId];
                                const skillName = skill ? skill.name : skillId;
                                const isMastered = hardSkills.mastered && hardSkills.mastered.includes(skillId);
                                return `
                                    <div class="flex items-center justify-between p-2 bg-purple-50 rounded">
                                        <span class="text-sm font-medium text-purple-900">${skillName}</span>
                                        <span class="text-xs px-2 py-1 rounded-full ${isMastered ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}">
                                            ${isMastered ? 'Освоен' : 'В развитии'}
                                        </span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        return;
    }

    container.innerHTML = plan.map(item => `
        <div class="border border-gray-200 rounded-lg p-4">
            <div class="flex items-start justify-between mb-2">
                <h4 class="font-medium text-gray-900">${item.skill || 'Навык не указан'}</h4>
                <span class="text-xs px-2 py-1 rounded-full ${
                    item.priority === 'high' ? 'bg-red-100 text-red-800' :
                    item.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                }">
                    ${item.priority === 'high' ? 'Высокий' :
                      item.priority === 'medium' ? 'Средний' : 'Низкий'}
                </span>
            </div>
            ${item.description ? `
                <p class="text-sm text-gray-600 mb-2">${item.description}</p>
            ` : ''}
            ${item.actions ? `
                <div class="space-y-1">
                    <p class="text-sm font-medium text-gray-700">Действия:</p>
                    <ul class="text-sm text-gray-600 space-y-1">
                        ${item.actions.map(action => `<li>• ${action}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            ${item.deadline ? `
                <p class="text-xs text-gray-500 mt-2">Срок: ${formatDate(item.deadline)}</p>
            ` : ''}
        </div>
    `).join('');
}

async function persistMotivationalTriggers() {
  const token = checkAuth();
  if (!token || !employeeId) return;

  const headers = isEmployeeView
    ? { 'Content-Type': 'application/json' }
    : { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const endpoint = isEmployeeView
    ? `/employee/${employeeId}/profile?token=${token}`
    : `/api/employee/${employeeId}/profile`;

  try {
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        // отправляем только нужное поле, чтобы ничего лишнего не затирать
        motivationalTriggers: currentEmployee.motivational_triggers || []
      })
    });
    if (response.ok) {
      const updated = await response.json();
      currentEmployee = updated;
      window.currentEmployee = updated;
    } else {
      console.warn('Failed to persist motivational triggers');
    }
  } catch (err) {
    console.error('Persist motivators error:', err);
  }
}


async function generateSecureLink() {
    const token = checkAuth();
    if (!token || !employeeId) return;

    try {
        const response = await fetch(`/api/employee/${employeeId}/secure-link`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Secure link generation failed:', response.status, errorText);
            throw new Error('Не удалось создать защищенную ссылку');
        }

        const data = await response.json();
        const secureUrl = `${window.location.origin}/employee/${employeeId}?token=${data.token}`;
        
        document.getElementById('shareLink').value = secureUrl;
        document.getElementById('shareModal').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error generating secure link:', error);
        showToast('Ошибка создания защищенной ссылки', 'error');
    }
}

function copyToClipboard() {
    const linkInput = document.getElementById('shareLink');
    linkInput.select();
    linkInput.setSelectionRange(0, 99999);
    
    try {
        document.execCommand('copy');
        showToast('Ссылка скопирована в буфер обмена');
    } catch (err) {
        console.error('Failed to copy: ', err);
        showToast('Не удалось скопировать ссылку', 'error');
    }
}

function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    window.location.href = '/login';
}

document.addEventListener('DOMContentLoaded', function() {
    employeeId = getEmployeeIdFromUrl();
    loadEmployeeProfile();

    document.getElementById('langRu').addEventListener('click', () => window.translationManager.setLanguage('ru'));
    document.getElementById('langEn').addEventListener('click', () => window.translationManager.setLanguage('en'));

    document.getElementById('shareProfileBtn').addEventListener('click', generateSecureLink);
    document.getElementById('closeShareModal').addEventListener('click', () => {
        document.getElementById('shareModal').classList.add('hidden');
    });
    document.getElementById('copyLinkBtn').addEventListener('click', copyToClipboard);

    document.getElementById('editProfileBtn').addEventListener('click', showEditModal);

    document.getElementById('addOkrBtn').addEventListener('click', openOkrModal);
    
    document.getElementById('setDiscBtn').addEventListener('click', openDiscModal);
    
    document.getElementById('addDevelopmentBtn').addEventListener('click', () => {
        openSkillTreeModal();
    });

    document.getElementById('closeSkillTreeModal').addEventListener('click', closeSkillTreeModal);
    document.getElementById('cancelSkillTree').addEventListener('click', closeSkillTreeModal);
    document.getElementById('saveSkillTree').addEventListener('click', saveSkillTreeData);
    document.getElementById('resetSkillSelection').addEventListener('click', resetSkillSelection);
    
    document.getElementById('softSkillsTab').addEventListener('click', () => switchSkillTreeTab('soft'));
    document.getElementById('hardSkillsTab').addEventListener('click', () => switchSkillTreeTab('hard'));

    initializeSkillTreeModal();

    document.getElementById('shareModal').addEventListener('click', (e) => {
        if (e.target.id === 'shareModal') {
            document.getElementById('shareModal').classList.add('hidden');
        }
    });

    document.getElementById('closeEditModal').addEventListener('click', hideEditModal);
    document.getElementById('cancelEditBtn').addEventListener('click', hideEditModal);
    document.getElementById('editProfileForm').addEventListener('submit', saveProfileChanges);
    
    document.getElementById('editModal').addEventListener('click', (e) => {
        if (e.target.id === 'editModal') {
            hideEditModal();
        }
    });

    initializeTagInputs();
    initializeDiscModal();
});

function initializeSkillTreeModal() {
    if (currentEmployee && currentEmployee.development_plan) {
        const plan = currentEmployee.development_plan;
        if (plan.softSkills || plan.hardSkills) {
            skillTreeState = {
                softSkills: plan.softSkills || { mastered: [], selected: [] },
                hardSkills: plan.hardSkills || { mastered: [], selected: [] },
                competencyArea: plan.hardSkills?.competencyArea || getCompetencyAreaFromDomains()
            };
        }
    }
}

function getCompetencyAreaFromDomains() {
    if (!currentEmployee || !currentEmployee.domains) return 'backend';
    
    const domains = currentEmployee.domains.toLowerCase();
    if (domains.includes('frontend') || domains.includes('фронтенд')) return 'frontend';
    if (domains.includes('devops') || domains.includes('девопс')) return 'devops';
    if (domains.includes('backend') || domains.includes('бэкенд')) return 'backend';
    if (domains.includes('qa') || domains.includes('тестирование')) return 'qa';
    if (domains.includes('data') || domains.includes('данные')) return 'data-analyst';
    if (domains.includes('ios')) return 'ios';
    if (domains.includes('android')) return 'android';
    if (domains.includes('ux') || domains.includes('дизайн')) return 'ux-design';
    
    return 'backend';
}

function openSkillTreeModal() {
    document.getElementById('skillTreeModal').classList.remove('hidden');
    initializeSkillTreeModal();
    renderSkillTree('soft');
    const svg = document.getElementById('softSkillsTreeSvg'); // и/или hard
    initZoomPan(svg);
    updateSkillCounters();
    updateCompetencyAreaDisplay();
}

function closeSkillTreeModal() {
    document.getElementById('skillTreeModal').classList.add('hidden');
    document.getElementById('skillDetailsPanel').classList.add('hidden');
}

function switchSkillTreeTab(type) {
    document.querySelectorAll('.skill-tree-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    if (type === 'soft') {
        document.getElementById('softSkillsTab').classList.add('active');
        document.getElementById('softSkillsTree').classList.remove('hidden');
        document.getElementById('hardSkillsTree').classList.add('hidden');
        renderSkillTree('soft');
    } else {
        document.getElementById('hardSkillsTab').classList.add('active');
        document.getElementById('softSkillsTree').classList.add('hidden');
        document.getElementById('hardSkillsTree').classList.remove('hidden');
        renderSkillTree('hard');
    }
}

function renderSkillTree(type) {
  // выбери правильный SVG (подстрой под свои id)
  const svgId = type === 'soft' ? 'softSkillsTreeSvg' : 'hardSkillsTreeSvg';
  const svg = document.getElementById(svgId);
  if (!svg) return;

  // очистка и создание viewport-группы
  svg.innerHTML = '';
  const vp = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  vp.setAttribute('id', 'skillTreeViewport');
  svg.appendChild(vp);

  // возьми нужные данные
  const allSkills = type === 'soft'
    ? SOFT_SKILLS_DATA
    : HARD_SKILLS_DATA[skillTreeState.competencyArea] || {};

  // сначала рёбра (чтобы были под узлами)
  Object.values(allSkills).forEach(to => {
    (to.prerequisites || []).forEach(fromId => {
      const from = allSkills[fromId];
      if (from) drawConnection(svg, from, to, allSkills);
    });
  });

  // затем узлы
  Object.values(allSkills).forEach(skill => {
    drawSkillNode(svg, skill, type);
  });

  // инициализируем зум/пан один раз на этот svg
  initZoomPan(svg);
}

function drawConnection(svg, fromSkill, toSkill, isActive, allSkills) {
  // 1) генерим прямую
  const d = makeStraightEdge(fromSkill, toSkill);

  // 2) создаём path
  const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathElement.setAttribute('d', d);
  pathElement.setAttribute('class', `skill-connection ${isActive ? 'active' : ''}`);
  pathElement.setAttribute('fill', 'none');
  pathElement.setAttribute('stroke', isActive ? '#3b82f6' : '#24a283'); // твой цвет
  pathElement.setAttribute('stroke-width', '2');
  pathElement.setAttribute('stroke-linecap', 'round');
  pathElement.setAttribute('stroke-linejoin', 'round');
  pathElement.style.pointerEvents = 'none';

  // 3) добавляем в viewport-слой
  const container = svg.querySelector('#skillTreeViewport') || svg;
  container.appendChild(pathElement);
}
function makeStraightEdge(a, b) {
  const ax = a.position.x, ay = a.position.y;
  const bx = b.position.x, by = b.position.y;

  const ra = Number(a.r) || 50;
  const rb = Number(b.r) || 50;

  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;

  // старт и финиш на окружностях, а не в центре
  const sx = ax + ux * ra;
  const sy = ay + uy * ra;
  const ex = bx - ux * rb;
  const ey = by - uy * rb;

  return `M ${sx} ${sy} L ${ex} ${ey}`;
}
function drawSkillNode(svg, skill, type) {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('class', `skill-node ${getSkillState(skill.id, type)}`);
  group.setAttribute('data-skill-id', skill.id);
  group.setAttribute('data-skill-type', type);

  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', skill.position.x);
  circle.setAttribute('cy', skill.position.y);
  circle.setAttribute('class', 'skill-node-circle');
  group.appendChild(circle);

  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', skill.position.x);
  text.setAttribute('y', skill.position.y);
  text.setAttribute('class', 'skill-node-text');
  // ... ваш код переноса строк остаётся как есть ...

  group.appendChild(text);

  // клики по ноду — не даём всплыть до svg (чтобы пан не стартовал)
  group.addEventListener('mousedown', (e) => e.stopPropagation());
  group.addEventListener('click', (event) => {
    event.stopPropagation();
    handleSkillClick(skill.id, type, 'left');
    showSkillTooltip(skill, type, event);
  });
  group.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleSkillClick(skill.id, type, 'right');
    showSkillTooltip(skill, type, event);
  });
  group.addEventListener('mouseenter', () => showSkillDetails(skill, type));
  group.addEventListener('mouseleave', () => hideSkillDetails());

  const container = svg.querySelector('#skillTreeViewport') || svg;
  container.appendChild(group);
}



function getSkillState(skillId, type) {
    const skills = skillTreeState[type === 'soft' ? 'softSkills' : 'hardSkills'];
    
    if (skills.mastered.includes(skillId)) {
        return 'mastered';
    }
    
    if (skills.selected.includes(skillId)) {
        return 'selected';
    }
    
    if (isSkillUnlocked(skillId, type)) {
        return 'available';
    }
    
    return 'locked';
}

function isSkillUnlocked(skillId, type) {
    return true;
}

function isConnectionActive(fromSkillId, toSkillId, type) {
    const skills = skillTreeState[type === 'soft' ? 'softSkills' : 'hardSkills'];
    return skills.mastered.includes(fromSkillId) && (skills.mastered.includes(toSkillId) || skills.selected.includes(toSkillId));
}

function initZoomPan(svg) {
  if (!svg || svg.dataset.zoomInit === '1') return;
  svg.dataset.zoomInit = '1';

  const vp = svg.querySelector('#skillTreeViewport');
  if (!vp) return;

  let scale = 1;
  let tx = 0, ty = 0;
  const minScale = 0.35, maxScale = 3;
  const zoomStep = 0.1;

  const apply = () => vp.setAttribute('transform', `translate(${tx} ${ty}) scale(${scale})`);

  let panning = false;
  let startX = 0, startY = 0;
  let spaceHeld = false;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      spaceHeld = true;
      svg.style.cursor = 'grab';
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      spaceHeld = false;
      if (!panning) svg.style.cursor = '';
    }
  });

  svg.addEventListener('mousedown', (e) => {
    const isMiddle = e.button === 1;
    const isLeft = e.button === 0;
    const onNode = !!e.target.closest('.skill-node');
    if (!(isMiddle || (isLeft && (spaceHeld || !onNode)))) return;

    panning = true;
    startX = e.clientX - tx;
    startY = e.clientY - ty;
    svg.style.cursor = 'grabbing';
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!panning) return;
    tx = e.clientX - startX;
    ty = e.clientY - startY;
    apply();
  });

  window.addEventListener('mouseup', () => {
    if (!panning) return;
    panning = false;
    svg.style.cursor = spaceHeld ? 'grab' : '';
  });

  const onWheel = (e) => {
    e.preventDefault();
    const rect = svg.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const prev = scale;
    const factor = e.deltaY < 0 ? (1 + zoomStep) : (1 - zoomStep);
    scale = Math.max(minScale, Math.min(maxScale, scale * factor));

    tx = cx - (cx - tx) * (scale / prev);
    ty = cy - (cy - ty) * (scale / prev);
    apply();
  };

  svg.addEventListener('wheel', onWheel, { passive: false });
  vp.addEventListener('wheel', onWheel, { passive: false });

  apply();
}




function handleSkillClick(skillId, type, clickType = 'left') {
    const state = getSkillState(skillId, type);
    const skills = skillTreeState[type === 'soft' ? 'softSkills' : 'hardSkills'];
    
    if (clickType === 'right') {
        if (state === 'mastered') {
            const index = skills.mastered.indexOf(skillId);
            if (index > -1) {
                skills.mastered.splice(index, 1);
            }
        } else {
            const selectedIndex = skills.selected.indexOf(skillId);
            if (selectedIndex > -1) {
                skills.selected.splice(selectedIndex, 1);
            }
            skills.mastered.push(skillId);
        }
    } else {
        if (state === 'selected') {
            const index = skills.selected.indexOf(skillId);
            if (index > -1) {
                skills.selected.splice(index, 1);
            }
        } else if (state === 'available' || state === 'mastered') {
            const masteredIndex = skills.mastered.indexOf(skillId);
            if (masteredIndex > -1) {
                skills.mastered.splice(masteredIndex, 1);
            }
            
            if (skills.selected.length >= 3) {
                showToast('Максимум 3 навыка для развития в каждой категории');
                return;
            }
            skills.selected.push(skillId);
        }
    }
    
    renderSkillTree(type);
    updateSkillCounters();
}

function showSkillDetails(skill, type) {
    const panel = document.getElementById('skillDetailsPanel');
    const title = document.getElementById('skillDetailTitle');
    const description = document.getElementById('skillDetailDescription');
    const benefit = document.getElementById('skillDetailBenefit');
    
    if (type === 'soft') {
        title.textContent = window.translationManager ? window.translationManager.t(skill.nameKey) : skill.nameKey;
        description.textContent = window.translationManager ? window.translationManager.t(skill.descKey) : skill.descKey;
        benefit.textContent = window.translationManager ? window.translationManager.t(skill.benefitKey) : skill.benefitKey;
    } else {
        title.textContent = skill.name;
        description.textContent = skill.desc;
        benefit.textContent = skill.benefit;
    }
    
    panel.classList.remove('hidden');
}

function hideSkillDetails() {
    setTimeout(() => {
        if (!document.getElementById('skillDetailsPanel').matches(':hover')) {
            document.getElementById('skillDetailsPanel').classList.add('hidden');
        }
    }, 100);
}

function showSkillTooltip(skill, type, event) {
  const tooltip = document.getElementById('skillTooltip');
  const title = document.getElementById('tooltipTitle');
  const description = document.getElementById('tooltipDescription');
  const benefit = document.getElementById('tooltipBenefit');

  if (type === 'soft') {
    title.textContent = window.translationManager ? window.translationManager.t(skill.nameKey) : skill.nameKey;
    description.textContent = window.translationManager ? window.translationManager.t(skill.descKey) : (skill.descKey || '');
    benefit.textContent = window.translationManager ? window.translationManager.t(skill.benefitKey) : (skill.benefitKey || '');
  } else {
    title.textContent = skill.name || '';
    description.textContent = skill.desc || '';
    benefit.textContent = skill.benefit || '';
  }

  const nodeEl = event.target.closest('.skill-node');
  if (!nodeEl) return;

  // контейнер модалки (relative), внутри него tooltip absolute
  const host = document.querySelector('#skillTreeModal .p-6') || tooltip.parentElement;
  const hostRect = host.getBoundingClientRect();
  const nodeRect = nodeEl.getBoundingClientRect();

  // показать невидимо, чтобы узнать реальные размеры
  tooltip.classList.remove('hidden');
  const prevVis = tooltip.style.visibility;
  tooltip.style.visibility = 'hidden';
  void tooltip.offsetWidth;

  const tW = tooltip.offsetWidth || 300;
  const tH = tooltip.offsetHeight || 140;

  let x = (nodeRect.right - hostRect.left) + 10;
  let y = (nodeRect.top - hostRect.top);

  // вправо не влезает — рисуем слева
  if (x + tW > hostRect.width) x = (nodeRect.left - hostRect.left) - tW - 10;
  // вниз не влезает — подвинем вверх
  if (y + tH > hostRect.height) y = Math.max(10, hostRect.height - tH - 10);
  if (y < 10) y = 10;

  tooltip.style.left = `${x}px`;
  tooltip.style.top  = `${y}px`;

  tooltip.style.visibility = prevVis || '';
  // автоскрытие оставим прежним (или уберите таймер, если нужно держать дольше)
  setTimeout(() => tooltip.classList.add('hidden'), 3000);
}


function hideSkillTooltip() {
  const tooltip = document.getElementById('skillTooltip');
  if (tooltip) tooltip.classList.add('hidden');
}


function updateSkillCounters() {
    const softCounter = document.getElementById('softSkillsCounter');
    const hardCounter = document.getElementById('hardSkillsCounter');
    
    softCounter.textContent = `${skillTreeState.softSkills.selected.length}/3`;
    hardCounter.textContent = `${skillTreeState.hardSkills.selected.length}/3`;
}

function updateCompetencyAreaDisplay() {
    const display = document.getElementById('currentCompetencyArea');
    const competencyArea = skillTreeState.competencyArea;
    
    const areaNames = {
        'backend': 'Backend Development',
        'frontend': 'Frontend Development',
        'devops': 'DevOps',
        'qa': 'QA Testing',
        'data-analyst': 'Data Analysis',
        'ios': 'iOS Development',
        'android': 'Android Development',
        'ux-design': 'UX Design'
    };
    
    display.textContent = areaNames[competencyArea] || competencyArea;
}

function addSkillLegend(svg) {
    const legend = document.createElement('div');
    legend.className = 'skill-legend';
    legend.innerHTML = `
        <div class="skill-legend-item">
            <div class="skill-legend-circle skill-legend-available"></div>
            <span>Доступен</span>
        </div>
        <div class="skill-legend-item">
            <div class="skill-legend-circle skill-legend-selected"></div>
            <span>Выбран</span>
        </div>
        <div class="skill-legend-item">
            <div class="skill-legend-circle skill-legend-mastered"></div>
            <span>Освоен</span>
        </div>
        <div class="skill-legend-item">
            <div class="skill-legend-circle skill-legend-locked"></div>
            <span>Заблокирован</span>
        </div>
    `;
    
    svg.parentElement.style.position = 'relative';
    svg.parentElement.appendChild(legend);
}

function resetSkillSelection() {
    skillTreeState.softSkills.selected = [];
    skillTreeState.hardSkills.selected = [];
    
    const currentTab = document.querySelector('.skill-tree-tab.active');
    const type = currentTab.id === 'softSkillsTab' ? 'soft' : 'hard';
    renderSkillTree(type);
    updateSkillCounters();
    
    showToast('Выбор навыков сброшен');
}

async function saveSkillTreeData() {
    const token = checkAuth();
    if (!token || !employeeId) return;
    
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        let endpoint;
        if (token.startsWith('Bearer ')) {
            headers['Authorization'] = token;
            endpoint = `/api/employee/${employeeId}/profile`;
        } else {
            endpoint = `/api/employee/${employeeId}/profile?token=${token}`;
        }
        
        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify({
                developmentPlan: {
                    softSkills: skillTreeState.softSkills,
                    hardSkills: {
                        ...skillTreeState.hardSkills,
                        competencyArea: skillTreeState.competencyArea
                    }
                }
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to save skill tree');
        }
        
        const updatedEmployee = await response.json();
        currentEmployee = updatedEmployee;
        
        displayDevelopmentPlan(updatedEmployee.development_plan);
        
        closeSkillTreeModal();
        showToast('Карта навыков сохранена');
        
    } catch (error) {
        console.error('Error saving skill tree:', error);
        showToast('Ошибка при сохранении карты навыков');
    }
}

const DISC_QUESTIONS = [
    {
        "id": 1,
        "question": "Как сотрудник, я предпочитаю принимать решения:",
        "options": [
            {"text": "Быстро и решительно, основываясь на своей интуиции", "type": "D", "score": 3},
            {"text": "После обсуждения с коллегами и получения их мнений", "type": "I", "score": 3},
            {"text": "Тщательно взвесив все за и против, не торопясь", "type": "S", "score": 3},
            {"text": "На основе детального анализа данных и фактов", "type": "C", "score": 3}
        ]
    },
    {
        "id": 2,
        "question": "В конфликтной ситуации в команде я:",
        "options": [
            {"text": "Беру инициативу и решаю проблему напрямую", "type": "D", "score": 3},
            {"text": "Стараюсь найти компромисс, который устроит всех", "type": "I", "score": 3},
            {"text": "Выслушиваю все стороны и ищу мирное решение", "type": "S", "score": 3},
            {"text": "Анализирую факты и предлагаю логичное решение", "type": "C", "score": 3}
        ]
    },
    {
        "id": 3,
        "question": "При работе над целями я:",
        "options": [
            {"text": "Ставлю амбициозные цели и стремлюсь к их достижению", "type": "D", "score": 3},
            {"text": "Вдохновляюсь общими целями команды", "type": "I", "score": 3},
            {"text": "Устанавливаю реалистичные цели с учетом своих возможностей", "type": "S", "score": 3},
            {"text": "Определяю четкие, измеримые цели с конкретными критериями", "type": "C", "score": 3}
        ]
    },
    {
        "id": 4,
        "question": "Мой стиль коммуникации с коллегами:",
        "options": [
            {"text": "Прямой и четкий, без лишних слов", "type": "D", "score": 3},
            {"text": "Дружелюбный и открытый, поощряю диалог", "type": "I", "score": 3},
            {"text": "Терпеливый и поддерживающий", "type": "S", "score": 3},
            {"text": "Точный и основанный на фактах", "type": "C", "score": 3}
        ]
    },
    {
        "id": 5,
        "question": "При планировании проектов я:",
        "options": [
            {"text": "Фокусируюсь на конечном результате и сроках", "type": "D", "score": 3},
            {"text": "Учитываю мнения всех участников команды", "type": "I", "score": 3},
            {"text": "Создаю стабильный план с минимальными рисками", "type": "S", "score": 3},
            {"text": "Разрабатываю детальный план с четкими этапами", "type": "C", "score": 3}
        ]
    },
    {
        "id": 6,
        "question": "Когда я делаю ошибку, я:",
        "options": [
            {"text": "Быстро признаю ошибку и исправляю ее", "type": "D", "score": 3},
            {"text": "Обсуждаю ошибку с коллегами и ищу решение вместе", "type": "I", "score": 3},
            {"text": "Анализирую причины ошибки, чтобы избежать ее в будущем", "type": "S", "score": 3},
            {"text": "Создаю процедуры для предотвращения подобных ошибок", "type": "C", "score": 3}
        ]
    },
    {
        "id": 7,
        "question": "В стрессовых ситуациях я:",
        "options": [
            {"text": "Беру контроль и быстро принимаю решения", "type": "D", "score": 3},
            {"text": "Поддерживаю команду и ищу творческие решения", "type": "I", "score": 3},
            {"text": "Остаюсь спокойным и стабилизирую ситуацию", "type": "S", "score": 3},
            {"text": "Систематически анализирую проблему и ищу оптимальное решение", "type": "C", "score": 3}
        ]
    },
    {
        "id": 8,
        "question": "Моя мотивация в работе:",
        "options": [
            {"text": "Вызовы и возможность конкурировать", "type": "D", "score": 3},
            {"text": "Позитивная атмосфера и признание достижений", "type": "I", "score": 3},
            {"text": "Стабильность и поддержка коллег", "type": "S", "score": 3},
            {"text": "Четкие критерии оценки и справедливое вознаграждение", "type": "C", "score": 3}
        ]
    },
    {
        "id": 9,
        "question": "При получении задач я:",
        "options": [
            {"text": "Сразу приступаю к выполнению и жду результатов", "type": "D", "score": 3},
            {"text": "Понимаю важность задачи и вдохновляюсь на выполнение", "type": "I", "score": 3},
            {"text": "Убеждаюсь, что готов и прошу поддержки при необходимости", "type": "S", "score": 3},
            {"text": "Изучаю детальные инструкции и критерии качества", "type": "C", "score": 3}
        ]
    },
    {
        "id": 10,
        "question": "На совещаниях я:",
        "options": [
            {"text": "Эффективно участвую, фокусируюсь на результатах", "type": "D", "score": 3},
            {"text": "Активно участвую и поощряю других к обсуждению", "type": "I", "score": 3},
            {"text": "Внимательно слушаю и даю всем высказаться", "type": "S", "score": 3},
            {"text": "Готовлюсь заранее и основываюсь на данных", "type": "C", "score": 3}
        ]
    },
    {
        "id": 11,
        "question": "При внедрении изменений в работе я:",
        "options": [
            {"text": "Быстро адаптируюсь к необходимым изменениям", "type": "D", "score": 3},
            {"text": "Активно участвую в процессе изменений", "type": "I", "score": 3},
            {"text": "Постепенно привыкаю к изменениям, минимизируя стресс", "type": "S", "score": 3},
            {"text": "Изучаю изменения поэтапно с четкими критериями", "type": "C", "score": 3}
        ]
    },
    {
        "id": 12,
        "question": "Мой подход к развитию навыков:",
        "options": [
            {"text": "Ставлю сложные задачи для быстрого роста", "type": "D", "score": 3},
            {"text": "Учусь через взаимодействие и обмен опытом", "type": "I", "score": 3},
            {"text": "Развиваюсь постепенно в комфортном темпе", "type": "S", "score": 3},
            {"text": "Следую структурированным программам развития", "type": "C", "score": 3}
        ]
    },
    {
        "id": 13,
        "question": "При работе в команде я предпочитаю:",
        "options": [
            {"text": "Брать на себя лидерство и направлять команду", "type": "D", "score": 3},
            {"text": "Поддерживать позитивную атмосферу и мотивировать коллег", "type": "I", "score": 3},
            {"text": "Быть надежным исполнителем и поддерживать других", "type": "S", "score": 3},
            {"text": "Обеспечивать качество и точность выполнения задач", "type": "C", "score": 3}
        ]
    },
    {
        "id": 14,
        "question": "Мой подход к рабочим процессам:",
        "options": [
            {"text": "Оптимизирую процессы для достижения максимальных результатов", "type": "D", "score": 3},
            {"text": "Делаю процессы более интерактивными и вовлекающими", "type": "I", "score": 3},
            {"text": "Поддерживаю стабильные и проверенные процессы", "type": "S", "score": 3},
            {"text": "Создаю детальные и структурированные процессы", "type": "C", "score": 3}
        ]
    },
    {
        "id": 15,
        "question": "При оценке своей работы я:",
        "options": [
            {"text": "Фокусируюсь на достигнутых результатах и целях", "type": "D", "score": 3},
            {"text": "Учитываю влияние на команду и общую атмосферу", "type": "I", "score": 3},
            {"text": "Оцениваю стабильность и надежность выполнения", "type": "S", "score": 3},
            {"text": "Анализирую качество и соответствие стандартам", "type": "C", "score": 3}
        ]
    }
];

let currentDiscQuestion = 0;
let discAnswers = {};
let selectedDiscAnswer = null;

function initializeDiscModal() {
    document.getElementById('closeDiscModal').addEventListener('click', closeDiscModal);
    document.getElementById('startDiscTest').addEventListener('click', startDiscTest);
    document.getElementById('prevQuestion').addEventListener('click', previousDiscQuestion);
    document.getElementById('nextQuestion').addEventListener('click', nextDiscQuestion);
    document.getElementById('retakeDiscTest').addEventListener('click', retakeDiscTest);
    document.getElementById('closeDiscResults').addEventListener('click', closeDiscModal);
    
    document.getElementById('discModal').addEventListener('click', (e) => {
        if (e.target.id === 'discModal') {
            closeDiscModal();
        }
    });
}

function openDiscModal() {
    document.getElementById('discModal').classList.remove('hidden');
    resetDiscTest();
}

function closeDiscModal() {
    document.getElementById('discModal').classList.add('hidden');
}

function resetDiscTest() {
    currentDiscQuestion = 0;
    discAnswers = {};
    selectedDiscAnswer = null;
    
    document.getElementById('discIntro').classList.remove('hidden');
    document.getElementById('discQuestion').classList.add('hidden');
    document.getElementById('discResults').classList.add('hidden');
    document.getElementById('discLoading').classList.add('hidden');
}

function startDiscTest() {
    document.getElementById('discIntro').classList.add('hidden');
    document.getElementById('discQuestion').classList.remove('hidden');
    
    currentDiscQuestion = 0;
    discAnswers = {};
    selectedDiscAnswer = null;
    
    showDiscQuestion();
}

function showDiscQuestion() {
    const question = DISC_QUESTIONS[currentDiscQuestion];
    const totalQuestions = DISC_QUESTIONS.length;
    const progress = ((currentDiscQuestion + 1) / totalQuestions) * 100;
    
    document.getElementById('currentQuestionNum').textContent = currentDiscQuestion + 1;
    document.getElementById('totalQuestions').textContent = totalQuestions;
    document.getElementById('progressPercent').textContent = Math.round(progress) + '%';
    document.getElementById('progressBar').style.width = progress + '%';
    
    document.getElementById('questionText').textContent = question.question;
    
    const optionsContainer = document.getElementById('questionOptions');
    optionsContainer.innerHTML = '';
    
    question.options.forEach((option, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option-item border-2 border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-300 transition-colors';
        optionDiv.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="radio w-5 h-5 border-2 border-gray-300 rounded-full flex items-center justify-center">
                    <div class="radio-selected w-2.5 h-2.5 bg-blue-600 rounded-full hidden"></div>
                </div>
                <span class="text-gray-700">${option.text}</span>
            </div>
        `;
        
        optionDiv.addEventListener('click', () => selectDiscAnswer(option.text, optionDiv));
        optionsContainer.appendChild(optionDiv);
    });
    
    selectedDiscAnswer = discAnswers[question.id] || null;
    if (selectedDiscAnswer) {
        const selectedOption = Array.from(optionsContainer.children).find(opt => 
            opt.querySelector('span').textContent === selectedDiscAnswer
        );
        if (selectedOption) {
            selectDiscAnswer(selectedDiscAnswer, selectedOption);
        }
    }
    
    updateDiscNavigation();
}

function selectDiscAnswer(answerText, optionElement) {
    document.querySelectorAll('.option-item').forEach(opt => {
        opt.classList.remove('border-blue-500', 'bg-blue-50');
        opt.classList.add('border-gray-200');
        opt.querySelector('.radio-selected').classList.add('hidden');
    });
    
    optionElement.classList.remove('border-gray-200');
    optionElement.classList.add('border-blue-500', 'bg-blue-50');
    optionElement.querySelector('.radio-selected').classList.remove('hidden');
    
    selectedDiscAnswer = answerText;
    updateDiscNavigation();
}

function updateDiscNavigation() {
    const prevBtn = document.getElementById('prevQuestion');
    const nextBtn = document.getElementById('nextQuestion');
    
    prevBtn.style.visibility = currentDiscQuestion === 0 ? 'hidden' : 'visible';
    nextBtn.disabled = !selectedDiscAnswer;
    nextBtn.textContent = currentDiscQuestion === DISC_QUESTIONS.length - 1 ? 'Завершить' : 'Далее';
}

function previousDiscQuestion() {
    if (currentDiscQuestion > 0) {
        currentDiscQuestion--;
        showDiscQuestion();
    }
}

function nextDiscQuestion() {
    if (!selectedDiscAnswer) return;
    
    discAnswers[DISC_QUESTIONS[currentDiscQuestion].id] = selectedDiscAnswer;
    
    if (currentDiscQuestion === DISC_QUESTIONS.length - 1) {
        submitDiscTest();
    } else {
        currentDiscQuestion++;
        selectedDiscAnswer = null;
        showDiscQuestion();
    }
}

async function submitDiscTest() {
    document.getElementById('discQuestion').classList.add('hidden');
    document.getElementById('discLoading').classList.remove('hidden');
    
    try {
        const token = checkAuth();
        const headers = isEmployeeView ? {} : {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        
        if (isEmployeeView) {
            headers['Content-Type'] = 'application/json';
        }
        
        const endpoint = isEmployeeView ? 
            `/employee/${employeeId}/disc-test?token=${token}` : 
            `/api/employee/${employeeId}/disc-test`;
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ answers: discAnswers })
        });
        
        if (!response.ok) {
            throw new Error('Не удалось сохранить результаты теста');
        }
        
        const result = await response.json();
        showDiscResults(result);
        
        if (currentEmployee) {
            currentEmployee.disc_type = result.personalityType;
            currentEmployee.disc_data = result.discData;
            displayEmployeeProfile(currentEmployee);
        }
        
        showToast('DISC тест успешно завершен!');
        
    } catch (error) {
        console.error('Error submitting DISC test:', error);
        showToast('Ошибка при сохранении результатов теста', 'error');
        document.getElementById('discLoading').classList.add('hidden');
        document.getElementById('discQuestion').classList.remove('hidden');
    }
}

function showDiscResults(result) {
    document.getElementById('discLoading').classList.add('hidden');
    document.getElementById('discResults').classList.remove('hidden');
    
    document.getElementById('resultPersonalityType').textContent = result.personalityType;
    
    const maxScore = 45;
    const scores = result.scores;
    
    document.getElementById('scoreD').style.width = (scores.D / maxScore * 100) + '%';
    document.getElementById('scoreI').style.width = (scores.I / maxScore * 100) + '%';
    document.getElementById('scoreS').style.width = (scores.S / maxScore * 100) + '%';
    document.getElementById('scoreC').style.width = (scores.C / maxScore * 100) + '%';
    
    document.getElementById('scoreDText').textContent = `${scores.D}/${maxScore}`;
    document.getElementById('scoreIText').textContent = `${scores.I}/${maxScore}`;
    document.getElementById('scoreSText').textContent = `${scores.S}/${maxScore}`;
    document.getElementById('scoreCText').textContent = `${scores.C}/${maxScore}`;
}

function calculateDiscScores(answers) {
    const scores = { D: 0, I: 0, S: 0, C: 0 };
    
    for (const [questionId, selectedAnswer] of Object.entries(answers)) {
        const question = DISC_QUESTIONS.find(q => q.id === parseInt(questionId));
        if (question) {
            const option = question.options.find(opt => opt.text === selectedAnswer);
            if (option) {
                scores[option.type] += option.score;
            }
        }
    }
    
    return scores;
}

function determinePersonalityType(scores) {
    const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const topScore = sortedScores[0][1];
    const secondScore = sortedScores[1][1];
    
    const topTypes = sortedScores.filter(([type, score]) => score === topScore).map(([type]) => type);
    
    if (topTypes.length === 1) {
        const scoreDifference = topScore - secondScore;
        if (scoreDifference <= 3) {
            const combinedTypes = {
                'DI': 'Вдохновитель',
                'DS': 'Организатор',
                'DC': 'Организатор', 
                'IS': 'Связной',
                'IC': 'Связной',
                'SC': 'Координатор'
            };
            
            const sortedTopTwo = [topTypes[0], sortedScores[1][0]].sort().join('');
            return combinedTypes[sortedTopTwo] || topTypes[0];
        }
        return topTypes[0];
    } else {
        const combinedTypes = {
            'DI': 'Вдохновитель',
            'DS': 'Организатор',
            'DC': 'Организатор',
            'IS': 'Связной', 
            'IC': 'Связной',
            'SC': 'Координатор'
        };
        
        const sortedTypes = topTypes.sort().join('');
        return combinedTypes[sortedTypes] || topTypes[0];
    }
}

function retakeDiscTest() {
    resetDiscTest();
    startDiscTest();
}

let currentOkrs = [];
let editingOkrIndex = -1;

function openOkrModal() {
    document.getElementById('okrModal').classList.remove('hidden');
    loadCurrentOkrs();
    initializeOkrModal();
}

function closeOkrModal() {
    document.getElementById('okrModal').classList.add('hidden');
    resetOkrModal();
}

function initializeOkrModal() {
    document.getElementById('closeOkrModal').addEventListener('click', closeOkrModal);
    document.getElementById('cancelOkrBtn').addEventListener('click', closeOkrModal);
    document.getElementById('okrForm').addEventListener('submit', saveOkrs);
    document.getElementById('addObjectiveBtn').addEventListener('click', addObjective);
    
    const generateBtn = document.getElementById('generateOkrBtn');
    const improveBtn = document.getElementById('improveOkrBtn');
    
    if (generateBtn) {
        generateBtn.addEventListener('click', generateOkrWithAI);
    }
    if (improveBtn) {
        improveBtn.addEventListener('click', improveOkrWithAI);
    }
    
    document.getElementById('okrModal').addEventListener('click', (e) => {
        if (e.target.id === 'okrModal') {
            closeOkrModal();
        }
    });
}

function loadCurrentOkrs() {
    const employee = currentEmployee || window.currentEmployee;
    if (employee && employee.okr_goals) {
        try {
            currentOkrs = typeof employee.okr_goals === 'string' ? 
                JSON.parse(employee.okr_goals) : employee.okr_goals;
        } catch (e) {
            currentOkrs = [];
        }
    } else {
        currentOkrs = [];
    }
    
    if (currentOkrs.length > 0) {
        document.getElementById('improveOkrBtn').classList.remove('hidden');
        document.getElementById('okrImprovementSection').classList.remove('hidden');
        renderOkrForm();
    } else {
        addObjective();
    }
}

function resetOkrModal() {
    document.getElementById('okrObjectives').innerHTML = '';
    document.getElementById('okrContext').value = '';
    document.getElementById('okrAdditionalGoals').value = '';
    document.getElementById('okrFeedback').value = '';
    document.getElementById('improveOkrBtn').classList.add('hidden');
    document.getElementById('okrImprovementSection').classList.add('hidden');
    editingOkrIndex = -1;
}

function addObjective() {
    const objectivesContainer = document.getElementById('okrObjectives');
    const objectiveIndex = objectivesContainer.children.length;
    
    if (objectiveIndex >= 3) {
        showToast('Максимум 3 цели на квартал');
        return;
    }
    
    const objectiveHtml = `
        <div class="objective-item border border-gray-200 rounded-lg p-4" data-index="${objectiveIndex}">
            <div class="flex justify-between items-start mb-3">
                <h4 class="font-medium text-gray-900">Цель ${objectiveIndex + 1}</h4>
                <button type="button" onclick="removeObjective(${objectiveIndex})" class="text-red-600 hover:text-red-800">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            
            <div class="space-y-3">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1" data-translate="employee.okr_objective">Цель</label>
                    <div class="flex space-x-2">
                        <textarea name="objective-${objectiveIndex}" class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" rows="2" required></textarea>
                        <button type="button" onclick="improveObjectiveWithAI(${objectiveIndex})" class="px-3 py-2 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200 text-sm" title="Улучшить с ИИ">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1" data-translate="employee.okr_deadline">Срок выполнения</label>
                    <input type="date" name="deadline-${objectiveIndex}" class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1" data-translate="employee.okr_key_results">Ключевые результаты</label>
                    <div class="key-results-container space-y-2" data-objective="${objectiveIndex}">
                        <div class="key-result-item flex space-x-2">
                            <input type="text" name="key-result-${objectiveIndex}-0" class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ключевой результат 1" required>
                            <button type="button" onclick="improveKeyResultWithAI(${objectiveIndex}, 0)" class="px-3 py-2 bg-green-100 text-green-600 rounded-md hover:bg-green-200 text-sm" title="Улучшить с ИИ">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                                </svg>
                            </button>
                            <button type="button" onclick="removeKeyResult(this)" class="text-red-600 hover:text-red-800">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <button type="button" onclick="addKeyResult(${objectiveIndex})" class="mt-2 text-sm text-blue-600 hover:text-blue-800">
                        + Добавить ключевой результат
                    </button>
                </div>
            </div>
        </div>
    `;
    
    objectivesContainer.insertAdjacentHTML('beforeend', objectiveHtml);
}

function removeObjective(index) {
    const objective = document.querySelector(`[data-index="${index}"]`);
    if (objective) {
        objective.remove();
        reindexObjectives();
    }
}

function addKeyResult(objectiveIndex) {
    const container = document.querySelector(`[data-objective="${objectiveIndex}"]`);
    const keyResultIndex = container.children.length;
    
    if (keyResultIndex >= 3) {
        showToast('Максимум 3 ключевых результата на цель');
        return;
    }
    
    const keyResultHtml = `
        <div class="key-result-item flex space-x-2">
            <input type="text" name="key-result-${objectiveIndex}-${keyResultIndex}" class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ключевой результат ${keyResultIndex + 1}" required>
            <button type="button" onclick="improveKeyResultWithAI(${objectiveIndex}, ${keyResultIndex})" class="px-3 py-2 bg-green-100 text-green-600 rounded-md hover:bg-green-200 text-sm" title="Улучшить с ИИ">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
            </button>
            <button type="button" onclick="removeKeyResult(this)" class="text-red-600 hover:text-red-800">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', keyResultHtml);
}

function removeKeyResult(button) {
    const keyResultItem = button.closest('.key-result-item');
    const container = keyResultItem.parentElement;
    
    if (container.children.length > 1) {
        keyResultItem.remove();
    } else {
        showToast('Должен быть хотя бы один ключевой результат');
    }
}

function reindexObjectives() {
    const objectives = document.querySelectorAll('.objective-item');
    objectives.forEach((objective, index) => {
        objective.setAttribute('data-index', index);
        objective.querySelector('h4').textContent = `Цель ${index + 1}`;
        
        const inputs = objective.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            const name = input.getAttribute('name');
            if (name) {
                const newName = name.replace(/\d+/, index);
                input.setAttribute('name', newName);
            }
        });
    });
}

function renderOkrForm() {
    const objectivesContainer = document.getElementById('okrObjectives');
    objectivesContainer.innerHTML = '';
    
    currentOkrs.forEach((okr, index) => {
        addObjective();
        const objective = document.querySelector(`[data-index="${index}"]`);
        
        objective.querySelector(`[name="objective-${index}"]`).value = okr.objective || '';
        objective.querySelector(`[name="deadline-${index}"]`).value = okr.deadline || '';
        
        if (okr.key_results && okr.key_results.length > 0) {
            const keyResultsContainer = objective.querySelector(`[data-objective="${index}"]`);
            keyResultsContainer.innerHTML = '';
            
            okr.key_results.forEach((kr, krIndex) => {
                addKeyResult(index);
                const keyResultInput = objective.querySelector(`[name="key-result-${index}-${krIndex}"]`);
                if (keyResultInput) {
                    keyResultInput.value = kr;
                }
            });
        }
    });
}

async function improveObjectiveWithAI(objectiveIndex) {
    const objectiveTextarea = document.querySelector(`textarea[name="objective-${objectiveIndex}"]`);
    const currentText = objectiveTextarea.value.trim();
    
    if (!currentText) {
        showToast('Введите текст цели для улучшения');
        return;
    }
    
    const button = document.querySelector(`button[onclick="improveObjectiveWithAI(${objectiveIndex})"]`);
    const originalHtml = button.innerHTML;
    
    try {
        button.innerHTML = '<div class="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>';
        button.disabled = true;
        
        const token = checkAuth();
        if (!token) return;
        
        const headers = isEmployeeView ? {} : {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        
        if (isEmployeeView) {
            headers['Content-Type'] = 'application/json';
        }
        
        const endpoint = isEmployeeView ? 
            `/employee/${employeeId}/okr-improve-single?token=${token}` : 
            `/api/employee/${employeeId}/okr-improve-single`;
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                text: currentText,
                type: 'objective',
                context: window.currentEmployee?.position || 'Сотрудник'
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.improvedText) {
            objectiveTextarea.value = data.improvedText;
            showToast('Цель улучшена с помощью ИИ');
        } else {
            throw new Error(data.error || 'Ошибка улучшения цели');
        }
    } catch (error) {
        console.error('Error improving objective:', error);
        showToast('Ошибка при улучшении цели: ' + error.message);
    } finally {
        button.innerHTML = originalHtml;
        button.disabled = false;
    }
}

async function improveKeyResultWithAI(objectiveIndex, keyResultIndex) {
    const keyResultInput = document.querySelector(`input[name="key-result-${objectiveIndex}-${keyResultIndex}"]`);
    const currentText = keyResultInput.value.trim();
    
    if (!currentText) {
        showToast('Введите текст ключевого результата для улучшения');
        return;
    }
    
    const button = document.querySelector(`button[onclick="improveKeyResultWithAI(${objectiveIndex}, ${keyResultIndex})"]`);
    const originalHtml = button.innerHTML;
    
    try {
        button.innerHTML = '<div class="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>';
        button.disabled = true;
        
        const token = checkAuth();
        if (!token) return;
        
        const headers = isEmployeeView ? {} : {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        
        if (isEmployeeView) {
            headers['Content-Type'] = 'application/json';
        }
        
        const endpoint = isEmployeeView ? 
            `/employee/${employeeId}/okr-improve-single?token=${token}` : 
            `/api/employee/${employeeId}/okr-improve-single`;
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                text: currentText,
                type: 'key_result',
                context: window.currentEmployee?.position || 'Сотрудник'
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.improvedText) {
            keyResultInput.value = data.improvedText;
            showToast('Ключевой результат улучшен с помощью ИИ');
        } else {
            throw new Error(data.error || 'Ошибка улучшения ключевого результата');
        }
    } catch (error) {
        console.error('Error improving key result:', error);
        showToast('Ошибка при улучшении ключевого результата: ' + error.message);
    } finally {
        button.innerHTML = originalHtml;
        button.disabled = false;
    }
}
// === OKR helpers (вставить выше displayOkrGoals) ===
function ensureKeyResultsCompleted(goal) {
  // гарантируем согласованность длин массивов
  const krCount = Array.isArray(goal.key_results) ? goal.key_results.length : 0;
  if (!Array.isArray(goal.key_results_completed)) {
    goal.key_results_completed = Array(krCount).fill(false);
  } else if (goal.key_results_completed.length !== krCount) {
    const arr = Array(krCount).fill(false);
    for (let i = 0; i < Math.min(goal.key_results_completed.length, krCount); i++) {
      arr[i] = !!goal.key_results_completed[i];
    }
    goal.key_results_completed = arr;
  }
  return goal;
}

function calculateOkrProgress(goal) {
  // Если есть ключевые результаты — считаем по ним
  if (Array.isArray(goal.key_results) && goal.key_results.length > 0) {
    ensureKeyResultsCompleted(goal);
    const total = goal.key_results.length;
    const done = goal.key_results_completed.filter(Boolean).length;
    return Math.round((done / total) * 100);
  }
  // Иначе — по статусу/флажку completed
  if (goal.completed) return 100;
  if (goal.status === 'in_progress') return 50;
  return 0;
}

function calculateTimeRemaining(deadline) {
  if (!deadline) return { days: null, isOverdue: false };
  const now = new Date();
  // поддержим как ISO, так и 'YYYY-MM-DD'
  const due = new Date(deadline);
  // нормализуем к полуночи без времени для корректного подсчёта дней
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.ceil((due.setHours(0,0,0,0) - now.setHours(0,0,0,0)) / msPerDay);
  return { days: Math.abs(days), isOverdue: days < 0 };
}
// === /OKR helpers ===

function collectOkrsFromForm() {
    const objectives = document.querySelectorAll('.objective-item');
    const okrs = [];
    
    objectives.forEach((objective, index) => {
        const objectiveText = objective.querySelector(`[name="objective-${index}"]`).value;
        const deadline = objective.querySelector(`[name="deadline-${index}"]`).value;
        
        const keyResults = [];
        const keyResultInputs = objective.querySelectorAll(`[name^="key-result-${index}-"]`);
        keyResultInputs.forEach(input => {
            if (input.value.trim()) {
                keyResults.push(input.value.trim());
            }
        });
        
        if (objectiveText.trim()) {
            const existingOkr = currentOkrs[index] || {};
            okrs.push({
                objective: objectiveText.trim(),
                key_results: keyResults,
                deadline: deadline,
                progress: existingOkr.progress || 0,
                status: existingOkr.status || 'not_started',
                completed: existingOkr.completed || false,
                key_results_completed: existingOkr.key_results_completed || keyResults.map(() => false)
            });
        }
    });
    
    return okrs;
}

async function saveOkrs(event) {
    event.preventDefault();

    const saveBtn = document.getElementById('saveOkrBtn');
    const originalText = saveBtn.textContent;

    try {
        saveBtn.textContent = 'Сохранение...';
        saveBtn.disabled = true;

        // 1) Собираем OKR из формы
        const okrs = collectOkrsFromForm();
        if (!okrs || okrs.length === 0) {
            showToast('Добавьте хотя бы одну цель');
            return;
        }

        const token = checkAuth();
        if (!token) return;

        // 2) Заголовки для обоих режимов
        const headers = isEmployeeView
            ? { 'Content-Type': 'application/json' }
            : { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

        let response;

        if (!isEmployeeView) {
            // ---------- АВТОРИЗОВАННЫЙ РЕЖИМ ----------
            // Пишем OKR через специальный эндпоинт
            response = await fetch(`/api/employee/${employeeId}/okrs`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ okr_goals: okrs }) // snake_case на фронте, camel на бэке
            });

            // Fallback: если вдруг маршрута нет — merge через PUT профиля
            if (response.status === 404) {
                const getResp = await fetch(`/api/employee/${employeeId}/profile`, { headers });
                if (!getResp.ok) {
                    throw new Error('Не удалось загрузить профиль для сохранения OKR');
                }
                const profile = await getResp.json();

                const mergedProfile = { ...profile, okr_goals: okrs };
                delete mergedProfile.created_at;
                delete mergedProfile.updated_at;

                response = await fetch(`/api/employee/${employeeId}/profile`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(mergedProfile)
                });
            }
        } else {
            // ---------- РЕЖИМ ЗАЩИЩЁННОЙ ССЫЛКИ ----------
            response = await fetch(`/employee/${employeeId}/profile?token=${token}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ okr_goals: okrs })
            });
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data?.error || 'Ошибка сохранения OKR');
        }

        // 3) Обновляем локально и UI
        if (currentEmployee) {
            currentEmployee.okr_goals = okrs;
        }
        if (window.currentEmployee) {
    window.currentEmployee.okr_goals = okrs;
}
        displayOkrGoals(okrs);
        closeOkrModal();
        showToast('OKR успешно сохранены');
    } catch (error) {
        console.error('Error saving OKRs:', error);
        showToast('Ошибка при сохранении OKR: ' + error.message, 'error');
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}



async function toggleOkrCompletion(goalIndex, type, keyResultIndex = null) {
    try {
        const employee = window.currentEmployee;
        let okrs = [];
        
        if (employee && employee.okr_goals) {
            okrs = typeof employee.okr_goals === 'string' ? 
                JSON.parse(employee.okr_goals) : employee.okr_goals;
        }
        
        if (!okrs[goalIndex]) return;
        
        if (type === 'objective') {
            okrs[goalIndex].completed = !okrs[goalIndex].completed;
            okrs[goalIndex].status = okrs[goalIndex].completed ? 'completed' : 'in_progress';
        } else if (type === 'key_result' && keyResultIndex !== null) {
            if (!okrs[goalIndex].key_results_completed) {
                okrs[goalIndex].key_results_completed = okrs[goalIndex].key_results.map(() => false);
            }
            okrs[goalIndex].key_results_completed[keyResultIndex] = !okrs[goalIndex].key_results_completed[keyResultIndex];
            
            const completedCount = okrs[goalIndex].key_results_completed.filter(completed => completed).length;
            const totalCount = okrs[goalIndex].key_results_completed.length;
            
            if (completedCount === totalCount) {
                okrs[goalIndex].status = 'completed';
                okrs[goalIndex].completed = true;
            } else if (completedCount > 0) {
                okrs[goalIndex].status = 'in_progress';
                okrs[goalIndex].completed = false;
            } else {
                okrs[goalIndex].status = 'not_started';
                okrs[goalIndex].completed = false;
            }
        }
        
        okrs[goalIndex].progress = calculateOkrProgress(okrs[goalIndex]);
        
        const token = checkAuth();
        if (!token) return;
        
        const headers = isEmployeeView ? {} : {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        
        if (isEmployeeView) {
            headers['Content-Type'] = 'application/json';
        }
        
        const endpoint = isEmployeeView ? 
            `/employee/${employeeId}/profile?token=${token}` : 
            `/api/employee/${employeeId}/profile`;
        
        const response = await fetch(endpoint, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                okr_goals: okrs
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (currentEmployee) {
                currentEmployee.okr_goals = okrs;
                displayOkrGoals(okrs);
            }
        } else {
            throw new Error('Ошибка обновления статуса');
        }
    } catch (error) {
        console.error('Error toggling OKR completion:', error);
        showToast('Ошибка при обновлении статуса: ' + error.message);
    }
}

function generateOkrWithAI() {
    const context = document.getElementById('okrContext').value;
    const additionalGoals = document.getElementById('okrAdditionalGoals').value;
    const position = window.currentEmployee?.position || 'Not specified';
    
    const generateBtn = document.getElementById('generateOkrBtn');
    const originalText = generateBtn.textContent;
    generateBtn.textContent = translations[currentLanguage].employee.okr_generating || 'Генерация...';
    generateBtn.disabled = true;
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    };
    
    const endpoint = `/api/employee/${getEmployeeIdFromUrl()}/okr-generate`;
    
    fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            context: context,
            position: position,
            goals: additionalGoals
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to generate OKRs');
        }
        return response.json();
    })
    .then(data => {
        if (data.success && data.okrs) {
            populateOkrForm(data.okrs);
            document.getElementById('improveOkrBtn').classList.remove('hidden');
        }
    })
    .catch(error => {
        console.error('Error generating OKRs:', error);
        showToast(translations[currentLanguage].employee.okr_error || 'Ошибка при генерации OKR', 'error');
    })
    .finally(() => {
        generateBtn.textContent = originalText;
        generateBtn.disabled = false;
    });
}

function improveOkrWithAI() {
    const feedback = document.getElementById('okrFeedback').value;
    const currentOkrs = collectOkrsFromForm();
    
    if (currentOkrs.length === 0) {
        showToast('Сначала добавьте OKR цели', 'error');
        return;
    }
    
    const improveBtn = document.getElementById('improveOkrBtn');
    const originalText = improveBtn.textContent;
    improveBtn.textContent = translations[currentLanguage].employee.okr_improving || 'Улучшение...';
    improveBtn.disabled = true;
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    };
    
    const endpoint = `/api/employee/${getEmployeeIdFromUrl()}/okr-improve`;
    
    fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            okrs: currentOkrs,
            feedback: feedback
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to improve OKRs');
        }
        return response.json();
    })
    .then(data => {
        if (data.success && data.okrs) {
            populateOkrForm(data.okrs);
        }
    })
    .catch(error => {
        console.error('Error improving OKRs:', error);
        showToast(translations[currentLanguage].employee.okr_error || 'Ошибка при улучшении OKR', 'error');
    })
    .finally(() => {
        improveBtn.textContent = originalText;
        improveBtn.disabled = false;
    });
}

function populateOkrForm(okrs) {
    const objectivesContainer = document.getElementById('okrObjectives');
    objectivesContainer.innerHTML = '';
    
    okrs.forEach((okr, index) => {
        addObjective();
        const objectiveDiv = objectivesContainer.children[index];
        
        const objectiveInput = objectiveDiv.querySelector('input[name="objective"]');
        const deadlineInput = objectiveDiv.querySelector('input[name="deadline"]');
        const progressInput = objectiveDiv.querySelector('input[name="progress"]');
        
        if (objectiveInput) objectiveInput.value = okr.objective || '';
        if (deadlineInput) deadlineInput.value = okr.deadline || '';
        if (progressInput) progressInput.value = okr.progress || 0;
        
        const keyResultsContainer = objectiveDiv.querySelector('.key-results-container');
        if (keyResultsContainer && okr.key_results) {
            keyResultsContainer.innerHTML = '';
            okr.key_results.forEach(keyResult => {
                addKeyResult(index);
                const keyResultInputs = keyResultsContainer.querySelectorAll('input[name="key_result"]');
                const lastInput = keyResultInputs[keyResultInputs.length - 1];
                if (lastInput) lastInput.value = keyResult;
            });
        }
    });
}

function editOkr(index) {
    editingOkrIndex = index;
    openOkrModal();
}

async function deleteOkr(index) {
    if (!confirm('Вы уверены, что хотите удалить эту цель?')) {
        return;
    }
    
    try {
        const employee = window.currentEmployee;
        let okrs = [];
        
        if (employee && employee.okr_goals) {
            okrs = typeof employee.okr_goals === 'string' ? 
                JSON.parse(employee.okr_goals) : employee.okr_goals;
        }
        
        okrs.splice(index, 1);
        
        const token = checkAuth();
        if (!token) return;
        
        const headers = isEmployeeView ? {} : {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        
        if (isEmployeeView) {
            headers['Content-Type'] = 'application/json';
        }
        
        const endpoint = isEmployeeView ? 
            `/employee/${employeeId}/profile?token=${token}` : 
            `/api/employee/${employeeId}/profile`;
        
        const response = await fetch(endpoint, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                okr_goals: okrs
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (currentEmployee) {
                currentEmployee.okr_goals = okrs;
                displayOkrGoals(okrs);
            }
            showToast('Цель успешно удалена');
        } else {
            throw new Error('Ошибка удаления цели');
        }
    } catch (error) {
        console.error('Error deleting OKR:', error);
        showToast('Ошибка при удалении цели: ' + error.message);
    }
}

function showEditModal() {
    if (!currentEmployee) return;
    
    document.getElementById('editName').value = currentEmployee.name || '';
    document.getElementById('editEmail').value = currentEmployee.email || '';
    document.getElementById('editPosition').value = currentEmployee.position || '';
    document.getElementById('editPhone').value = currentEmployee.phone || '';
    document.getElementById('editMeetingTimes').value = currentEmployee.meeting_times || '';
    document.getElementById('editCommStyle').value = currentEmployee.comm_style || '';
    document.getElementById('editWorkStyle').value = currentEmployee.work_style || '';
    document.getElementById('editMotivators').value = currentEmployee.motivators || '';
    document.getElementById('editDemotivators').value = currentEmployee.demotivators || '';
    
    initializeEditMotivationalTriggers();
    setupEditWorkspaceDropZone();
    
    populateTagField('roles', currentEmployee.roles);
    populateTagField('domains', currentEmployee.domains);
    populateTagField('expertise', currentEmployee.expertise);
    populateTagField('personal_interests', currentEmployee.personal_interests);
    populateTagField('comm_channels', currentEmployee.comm_channels);
    populateTagField('stakeholders', currentEmployee.stakeholders);
    populateTagField('important_traits', currentEmployee.important_traits);

const tzEl = document.getElementById('editTimeZone');
if (tzEl) tzEl.value = currentEmployee.time_zone || '';
    document.getElementById('editModal').classList.remove('hidden');
}

function hideEditModal() {
    document.getElementById('editModal').classList.add('hidden');
}

function populateTagField(fieldName, value) {
    const container = document.querySelector(`[data-field="${fieldName}"]`);
    const display = container.querySelector('.tag-display');
    
    display.innerHTML = '';
    
    if (value) {
        const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag);
        tags.forEach(tag => {
            addTagToDisplay(display, tag);
        });
    }
}

function addTagToDisplay(display, tagText) {
    const tagElement = document.createElement('div');
    tagElement.className = 'tag-item';
    tagElement.innerHTML = `
        <span>${tagText}</span>
        <span class="tag-remove" onclick="removeTag(this)">×</span>
    `;
    display.appendChild(tagElement);
}

function removeTag(element) {
    element.parentElement.remove();
}

function initializeTagInputs() {
    document.querySelectorAll('.tag-input-container').forEach(container => {
        const input = container.querySelector('.tag-input');
        const suggestions = container.querySelector('.tag-suggestions');
        const display = container.querySelector('.tag-display');
        
        input.addEventListener('focus', () => {
            suggestions.classList.remove('hidden');
        });
        
        input.addEventListener('blur', (e) => {
            setTimeout(() => {
                suggestions.classList.add('hidden');
            }, 200);
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const value = input.value.trim();
                if (value) {
                    addTagToDisplay(display, value);
                    input.value = '';
                }
            }
        });
        
        suggestions.addEventListener('click', (e) => {
            if (e.target.classList.contains('tag-option')) {
                const value = e.target.dataset.value;
                addTagToDisplay(display, value);
                input.value = '';
                suggestions.classList.add('hidden');
            }
        });
    });
}

function getTagValues(fieldName) {
    const container = document.querySelector(`[data-field="${fieldName}"]`);
    const tags = container.querySelectorAll('.tag-item span:first-child');
    return Array.from(tags).map(tag => tag.textContent).join(', ');
}

async function saveProfileChanges(e) {
    e.preventDefault();
    
    const token = checkAuth();
    if (!token || !employeeId) return;

    // собираем данные из формы
    const profileData = {
        name: document.getElementById('editName').value,
        email: document.getElementById('editEmail').value,
        position: document.getElementById('editPosition').value,
        phone: document.getElementById('editPhone').value,

        // теги
        roles: getTagValues('roles'),
        domains: getTagValues('domains'),
        expertise: getTagValues('expertise'),
        personalInterests: getTagValues('personal_interests'), // было personal_interests
        commChannels: getTagValues('comm_channels'),           // было comm_channels
        stakeholders: getTagValues('stakeholders'),            // добавили
        importantTraits: getTagValues('important_traits'),     // добавили

        // строки
        meetingTimes: document.getElementById('editMeetingTimes').value, // было meeting_times
        commStyle: document.getElementById('editCommStyle').value,       // было comm_style
        workStyle: document.getElementById('editWorkStyle').value,       // было work_style
        motivators: document.getElementById('editMotivators').value,
        demotivators: document.getElementById('editDemotivators').value,
        motivationalTriggers: currentEmployee.motivational_triggers || []
    };

    // опционально — часовой пояс, если поле есть в модалке
    const tzEl = document.getElementById('editTimeZone');
    if (tzEl) profileData.timeZone = tzEl.value;

    try {
        const headers = isEmployeeView
            ? { 'Content-Type': 'application/json' }
            : { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

        // ВАЖНО: в режиме по токену должен быть публичный endpoint (без /api)
        const endpoint = isEmployeeView
            ? `/employee/${employeeId}/profile?token=${token}`
            : `/api/employee/${employeeId}/profile`;

        const response = await fetch(endpoint, {
            method: 'PUT',
            headers,
            body: JSON.stringify(profileData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Profile save failed:', response.status, errorText);
            throw new Error('Не удалось сохранить изменения');
        }

        const updatedEmployee = await response.json();
        currentEmployee = updatedEmployee;
        window.currentEmployee = updatedEmployee; // синхронизируем оба места
        displayEmployeeProfile(updatedEmployee);
        hideEditModal();
        showToast('Профиль успешно обновлен');
    } catch (error) {
        console.error('Error saving profile:', error);
        showToast('Ошибка сохранения профиля', 'error');
    }
}
// === Tips for motivational triggers ===
const DEFAULT_TRIGGER_TIPS = {
  curiosity:   'Любопытство: доступ к новой информации и исследованиям.',
  honor:       'Честь/признание: видимая оценка вклада и достижений.',
  acceptance:  'Принятие: ощущение принадлежности к команде/культуре.',
  mastery:     'Мастерство: сложные задачи, рост компетенций, обучение.',
  power:       'Влияние: возможность принимать решения и менять исход.',
  freedom:     'Свобода: автономия в выборе способов и порядка работы.',
  relatedness: 'Связи: работа с людьми, доверие и командные взаимодействия.',
  order:       'Порядок: ясные процессы, правила, предсказуемость.',
  goal:        'Цели: ясные, измеримые ориентиры и прогресс к ним.',
  status:      'Статус: роль/титул/видимость экспертизы и результатов.'
};

// Берём перевод из файлов локализаций, иначе — фолбэк
function getTriggerTip(triggerId) {
  const key = `motivational_triggers.tips.${triggerId}`;
  if (window.translationManager) {
    const tip = window.translationManager.t(key);
    if (tip && tip !== key) return tip;

    // общий дефолт из переводов, если есть
    const common = window.translationManager.t('motivational_triggers.tips._default');
    if (common && common !== 'motivational_triggers.tips._default') return common;
  }
  return DEFAULT_TRIGGER_TIPS[triggerId] || 'Подсказка будет добавлена позже.';
}

// Создаёт/показывает тултип рядом с кнопкой
function showTriggerTooltip(anchorEl, text) {
  hideTriggerTooltip(); // на всякий случай закрыть другие

  const rect = anchorEl.getBoundingClientRect();
  const tt = document.createElement('div');
  tt.id = 'trigger-tooltip';
  tt.className = 'fixed z-50 max-w-xs bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg';
  tt.style.top = `${rect.bottom + 8}px`;
  tt.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 260))}px`;
  tt.textContent = text;

  document.body.appendChild(tt);

  // клик вне — закрыть
  setTimeout(() => {
    function off(e) {
      if (!tt.contains(e.target) && e.target !== anchorEl) {
        hideTriggerTooltip();
        document.removeEventListener('mousedown', off, true);
        document.removeEventListener('touchstart', off, true);
      }
    }
    document.addEventListener('mousedown', off, true);
    document.addEventListener('touchstart', off, true);
  }, 0);
}

function hideTriggerTooltip() {
  const el = document.getElementById('trigger-tooltip');
  if (el) el.remove();
}

// Добавляет кнопку "i" на карточку и вешает обработчики
function attachTriggerHelp(cardEl) {
  if (!cardEl || cardEl.querySelector('.trigger-help-btn')) return;

  // Обертка, чтобы позиционировать иконку
  cardEl.classList.add('relative');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'trigger-help-btn absolute -top-2 -right-2 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow focus:outline-none';
  btn.setAttribute('aria-label', 'Подсказка по триггеру');
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M11 17h2m-1-8h.01M12 3a9 9 0 100 18 9 9 0 000-18z"/>
    </svg>
  `;

  // не даем начаться drag при нажатии на кнопку
  btn.addEventListener('mousedown', e => e.stopPropagation(), { passive: true });
  btn.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = cardEl.getAttribute('data-trigger-id');
    showTriggerTooltip(btn, getTriggerTip(id));
  });

  cardEl.appendChild(btn);
}

// Вызывает attachTriggerHelp для всех карточек триггеров (и в библиотеке, и на рабочем поле)
function attachHelpToAllTriggers() {
  const nodes = document.querySelectorAll(
    '#triggersLibrary [data-trigger-id], #triggersWorkspace [data-trigger-id], #editTriggersWorkspace [data-trigger-id]'
  );
  nodes.forEach(attachTriggerHelp);
}

const MOTIVATIONAL_TRIGGERS = [
    { id: 'curiosity', color: '#3b82f6', icon: '🔍' },
    { id: 'honor', color: '#10b981', icon: '🏆' },
    { id: 'acceptance', color: '#f59e0b', icon: '👥' },
    { id: 'mastery', color: '#8b5cf6', icon: '⚡' },
    { id: 'power', color: '#ef4444', icon: '💪' },
    { id: 'freedom', color: '#06b6d4', icon: '🕊️' },
    { id: 'relatedness', color: '#ec4899', icon: '❤️' },
    { id: 'order', color: '#84cc16', icon: '📋' },
    { id: 'goal', color: '#f97316', icon: '🎯' },
    { id: 'status', color: '#6366f1', icon: '👑' }
];

function initializeMotivationalTriggers() {
    const palette = document.getElementById('triggersPalette');
    const workspace = document.getElementById('triggersWorkspace');
    
    if (!palette || !workspace) return;
    
    palette.innerHTML = '';
    
    MOTIVATIONAL_TRIGGERS.forEach(trigger => {
        const card = createTriggerCard(trigger, false);
        palette.appendChild(card);
    });
    
    if (currentEmployee && currentEmployee.motivational_triggers) {
        loadTriggerPositions(currentEmployee.motivational_triggers, false);
    }
    attachHelpToAllTriggers();

}

function initializeEditMotivationalTriggers() {
    const palette = document.getElementById('editTriggersPalette');
    const workspace = document.getElementById('editTriggersWorkspace');
    
    if (!palette || !workspace) return;
    
    palette.innerHTML = '';
    
    MOTIVATIONAL_TRIGGERS.forEach(trigger => {
        const card = createTriggerCard(trigger, true);
        palette.appendChild(card);
    });
    
    if (currentEmployee && currentEmployee.motivational_triggers) {
        loadTriggerPositions(currentEmployee.motivational_triggers, true);
    }
     attachHelpToAllTriggers();
}
// Компактная слойная раскладка: минимизируем длину связей и держим минимальные отступы
function autoLayoutCompactDAG(skills, opts = {}) {
  const ids = Object.keys(skills);
  if (!ids.length) return;

  const r = opts.r ?? 50;                // радиус ноды (впишем его же в данные)
  const minSep = opts.minSep ?? (2*r + 24); // минимальная горизонтальная дистанция между центрами соседей
  const layerGap = opts.layerGap ?? 160;    // вертикальный шаг между уровнями
  const left = opts.left ?? 120;            // левый отступ
  const top  = opts.top  ?? 80;             // верхний отступ
  const iters = opts.iters ?? 3;            // число проходов сглаживания

  // --- граф ---
  const parents = new Map(ids.map(id => [id, []]));
  const children = new Map(ids.map(id => [id, []]));
  const indeg = new Map(ids.map(id => [id, 0]));

  for (const id of ids) {
    const prs = (skills[id].prerequisites || []).filter(p => skills[p]);
    parents.set(id, prs);
    for (const p of prs) {
      children.get(p).push(id);
      indeg.set(id, (indeg.get(id) || 0) + 1);
    }
  }

  // --- уровни (Kahn) ---
  const levels = [];
  let L = ids.filter(id => (indeg.get(id) || 0) === 0);
  const seen = new Set(L);
  while (L.length) {
    levels.push(L);
    const next = [];
    for (const u of L) {
      for (const v of children.get(u)) {
        indeg.set(v, indeg.get(v) - 1);
        if (indeg.get(v) === 0 && !seen.has(v)) { seen.add(v); next.push(v); }
      }
    }
    L = next;
  }
  const rest = ids.filter(id => !seen.has(id)); // на случай циклов
  if (rest.length) levels.push(rest);

  // --- начальные x: просто по порядку в уровне ---
  const x = new Map();
  for (const lvl of levels) {
    lvl.forEach((id, i) => x.set(id, i * minSep));
  }

  const median = (arr) => {
    if (!arr.length) return null;
    const a = [...arr].sort((a,b)=>a-b);
    const m = Math.floor(a.length/2);
    return a.length % 2 ? a[m] : (a[m-1] + a[m]) / 2;
  };

  // раздвинуть вправо, затем подтянуть влево — компактно и без наложений
  const resolveCollisions = (lvl) => {
    const order = [...lvl].sort((a,b) => x.get(a) - x.get(b));
    let cursor = -Infinity;
    for (const id of order) {
      const nx = Math.max(x.get(id), cursor + minSep);
      x.set(id, nx);
      cursor = nx;
    }
    // обратный проход — чуть «собрать» к центру
    let prev = Infinity;
    for (let i = order.length - 1; i >= 0; i--) {
      const id = order[i];
      const nx = Math.min(x.get(id), prev - minSep);
      x.set(id, nx);
      prev = nx;
    }
  };

  // несколько «протяжек» к родителям/детям
  for (let it = 0; it < iters; it++) {
    // сверху вниз — тянем к родителям
    for (let li = 1; li < levels.length; li++) {
      const lvl = levels[li];
      for (const id of lvl) {
        const m = median(parents.get(id).map(p => x.get(p)));
        if (m != null) x.set(id, 0.7*m + 0.3*x.get(id));
      }
      resolveCollisions(lvl);
    }
    // снизу вверх — тянем к детям
    for (let li = levels.length - 2; li >= 0; li--) {
      const lvl = levels[li];
      for (const id of lvl) {
        const m = median(children.get(id).map(c => x.get(c)));
        if (m != null) x.set(id, 0.7*m + 0.3*x.get(id));
      }
      resolveCollisions(lvl);
    }
  }

  // нормализуем, чтобы минимум был у левого отступа
  const minX = Math.min(...[...x.values()]);
  for (let li = 0; li < levels.length; li++) {
    for (const id of levels[li]) {
      const sx = left + (x.get(id) - minX);
      const sy = top + li * layerGap;
      const node = skills[id];
      node.position = { x: sx, y: sy };
      node.r = node.r ?? r;
    }
  }
}

function createTriggerCard(trigger, isEdit) {
    const card = document.createElement('div');
    card.className = 'trigger-card';
    card.draggable = true;
    card.dataset.triggerId = trigger.id;
    card.dataset.isEdit = isEdit;
    card.style.backgroundColor = trigger.color;
    card.style.color = 'white';
    
    const translationKey = `motivational_triggers.cards.${trigger.id}`;
    const translatedName = window.translationManager ? window.translationManager.t(translationKey) : trigger.id;
    
    card.innerHTML = `
        <div style="font-size: 20px; margin-bottom: 4px;">${trigger.icon}</div>
        <div style="font-weight: 600; font-size: 9px; line-height: 1.1;">${translatedName}</div>
    `;
    
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
    
    return card;
}

function handleDragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.dataset.triggerId);
    e.dataTransfer.setData('application/x-is-edit', e.target.dataset.isEdit);
    e.target.classList.add('dragging');
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

function setupWorkspaceDropZone() {
    const workspace = document.getElementById('triggersWorkspace');
    if (!workspace) return;
    
    workspace.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    
    workspace.addEventListener('drop', (e) => {
        e.preventDefault();
        const triggerId = e.dataTransfer.getData('text/plain');
        const isEdit = e.dataTransfer.getData('application/x-is-edit') === 'true';
        
        if (isEdit) return;
        
        const rect = workspace.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const scale = Math.max(1, Math.min(10, Math.round((x / rect.width) * 10)));
        const isAboveLine = y < rect.height / 2;
        
        const existingCardInSection = currentEmployee.motivational_triggers?.find(t => t.scale === scale);
        if (existingCardInSection && existingCardInSection.id !== triggerId) {
            returnCardToPalette(existingCardInSection.id, false);
        }
        
        positionTriggerCard(triggerId, scale, isAboveLine, x, y, false);
    });
}

function setupEditWorkspaceDropZone() {
    const workspace = document.getElementById('editTriggersWorkspace');
    if (!workspace) return;
    
    workspace.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    
    workspace.addEventListener('drop', (e) => {
        e.preventDefault();
        const triggerId = e.dataTransfer.getData('text/plain');
        const isEdit = e.dataTransfer.getData('application/x-is-edit') === 'true';
        
        if (!isEdit) return;
        
        const rect = workspace.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const scale = Math.max(1, Math.min(10, Math.round((x / rect.width) * 10)));
        const isAboveLine = y < rect.height / 2;
        
        const existingCardInSection = currentEmployee.motivational_triggers?.find(t => t.scale === scale);
        if (existingCardInSection && existingCardInSection.id !== triggerId) {
            returnCardToPalette(existingCardInSection.id, true);
        }
        
        positionTriggerCard(triggerId, scale, isAboveLine, x, y, true);
    });
}

function positionTriggerCard(triggerId, scale, isAboveLine, x, y, isEdit) {
  const cardSelector = `[data-trigger-id="${triggerId}"][data-is-edit="${isEdit}"]`;
  const card = document.querySelector(cardSelector);
  const workspaceId = isEdit ? 'editTriggersWorkspace' : 'triggersWorkspace';
  const workspace = document.getElementById(workspaceId);
  if (!card || !workspace) return;

  // --- защёлкивание по X к «центрам» 10 колонок ---
  const bucketWidth = workspace.clientWidth / 10;   // ширина одного деления
  const halfCard = 40;                               // половина 80px
  const snappedLeft = Math.max(
    0,
    Math.min((scale - 0.5) * bucketWidth - halfCard, workspace.clientWidth - 80)
  );

  // --- два «яруса» по Y: верх (25%) или низ (75%) области ---
  const centerYTop = Math.max(halfCard, Math.min(workspace.clientHeight * 0.25, workspace.clientHeight - halfCard));
  const centerYBottom = Math.max(halfCard, Math.min(workspace.clientHeight * 0.75, workspace.clientHeight - halfCard));
  const snappedTop = (isAboveLine ? centerYTop : centerYBottom) - halfCard;

  card.classList.add('positioned', 'in-workspace');
  card.style.position = 'absolute';
  card.style.left = `${snappedLeft}px`;
  card.style.top = `${snappedTop}px`;
  card.style.zIndex = '10';
  workspace.appendChild(card);

  // сохраняем уже «защёлкнутые» координаты (центр карточки)
  saveTriggerPosition(triggerId, scale, isAboveLine, snappedLeft + halfCard, snappedTop + halfCard);

  // автосохранение в БД после каждого перетаскивания
  persistMotivationalTriggers();
}


function saveTriggerPosition(triggerId, scale, isAboveLine, x, y) {
    if (!currentEmployee.motivational_triggers) {
        currentEmployee.motivational_triggers = [];
    }
    
    currentEmployee.motivational_triggers = currentEmployee.motivational_triggers.filter(
        t => t.id !== triggerId
    );
    
    currentEmployee.motivational_triggers.push({
        id: triggerId,
        scale: scale,
        isAboveLine: isAboveLine,
        x: x,
        y: y
    });
}

function loadTriggerPositions(positions, isEdit) {
    const workspaceId = isEdit ? 'editTriggersWorkspace' : 'triggersWorkspace';
    const workspace = document.getElementById(workspaceId);
    if (!workspace || !positions) return;
    
    positions.forEach(pos => {
        const cardSelector = `[data-trigger-id="${pos.id}"][data-is-edit="${isEdit}"]`;
        const card = document.querySelector(cardSelector);
        if (card) {
            positionTriggerCard(pos.id, pos.scale, pos.isAboveLine, pos.x, pos.y, isEdit);
        }
    });
}
function autoLayout(skills) {
  const keys = Object.keys(skills);
  const gapX = 300; // расстояние между карточками по горизонтали
  const gapY = 200; // расстояние между карточками по вертикали

  keys.forEach((key, i) => {
    const row = Math.floor(i / 5); // по 5 элементов в строке
    const col = i % 5;
    skills[key].position = {
      x: 150 + col * gapX,
      y: 100 + row * gapY
    };
    skills[key].r = 40; // добавляем радиус для edge routing
  });
}

function autoLayoutDAG(skills, opts = {}) {
  const gapX = opts.gapX ?? 240;
  const gapY = opts.gapY ?? 180;
  const nodeR = opts.r ?? 40;

  // 1) построим граф
  const ids = Object.keys(skills);
  const incoming = new Map(ids.map(id => [id, 0]));
  const children = new Map(ids.map(id => [id, []]));

  for (const id of ids) {
    const prereqs = skills[id].prerequisites || [];
    for (const p of prereqs) {
      if (!skills[p]) continue;
      incoming.set(id, (incoming.get(id) || 0) + 1);
      children.get(p).push(id);
    }
  }

  // 2) уровни (Kahn)
  const levels = [];
  let layer = ids.filter(id => (incoming.get(id) || 0) === 0);
  const seen = new Set(layer);

  while (layer.length) {
    levels.push(layer);
    const next = [];
    for (const u of layer) {
      for (const v of children.get(u)) {
        incoming.set(v, incoming.get(v) - 1);
        if (incoming.get(v) === 0 && !seen.has(v)) {
          seen.add(v); next.push(v);
        }
      }
    }
    layer = next;
  }

  // 3) оставшиеся (на случай циклов/ошибок в данных)
  const rest = ids.filter(id => !seen.has(id));
  if (rest.length) levels.push(rest);

  // 4) горизонтальное упорядочивание в уровне (минимизация «зигзагов»)
  // простая эвристика: сортируем по среднему индексу родителей
  const indexInPrev = new Map();
  levels.forEach((lvl, li) => {
    if (li === 0) {
      lvl.sort(); // стабильно
    } else {
      lvl.sort((a, b) => {
        const pa = (skills[a].prerequisites || []).filter(p => skills[p]);
        const pb = (skills[b].prerequisites || []).filter(p => skills[p]);
        const avg = (arr) => arr.length
          ? arr.map(p => indexInPrev.get(p) ?? 0).reduce((s,x)=>s+x,0)/arr.length
          : 0;
        return avg(pa) - avg(pb);
      });
    }
    lvl.forEach((id, i) => indexInPrev.set(id, i));
  });

  // 5) присвоение координат
  levels.forEach((lvl, y) => {
    lvl.forEach((id, x) => {
      skills[id].position = { x: 120 + x * gapX, y: 100 + y * gapY };
      skills[id].r = nodeR;
    });
  });
}


function returnCardToPalette(triggerId, isEdit) {
    const cardSelector = `[data-trigger-id="${triggerId}"][data-is-edit="${isEdit}"]`;
    const card = document.querySelector(cardSelector);
    const paletteId = isEdit ? 'editTriggersPalette' : 'triggersPalette';
    const palette = document.getElementById(paletteId);
    
    if (card && palette) {
        card.classList.remove('positioned', 'in-workspace');
        card.style.position = '';
        card.style.left = '';
        card.style.top = '';
        card.style.zIndex = '';
        
        palette.appendChild(card);
        
        if (currentEmployee.motivational_triggers) {
            currentEmployee.motivational_triggers = currentEmployee.motivational_triggers.filter(
                t => t.id !== triggerId
            );
        }
    }
}

