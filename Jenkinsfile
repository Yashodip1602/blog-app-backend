pipeline {
  agent any

 parameters {
    string(name: 'AWS_ACCOUNT_ID', defaultValue: '450730497369', description: 'AWS account ID')
    string(name: 'AWS_REGION', defaultValue: 'ap-south-1', description: 'AWS region')

    string(name: 'ECR_REPOSITORY', defaultValue: 'blog-app/blog-app-reop', description: 'ECR Repository')

    string(name: 'ECS_CLUSTER', defaultValue: 'default', description: 'ECS Cluster')

    string(name: 'ECS_SERVICE', defaultValue: 'blog-app-reop-de5c', description: 'ECS Service')

    string(name: 'IMAGE_NAME', defaultValue: 'app-b-backlog', description: 'Docker Image')

    string(name: 'GIT_REPO_URL', defaultValue: 'git@github.com:Yashodip1602/blog-app-backend.git', description: 'GitHub Repo')

    string(name: 'GIT_BRANCH', defaultValue: 'development', description: 'Git Branch')
}

  options {
    timestamps()
    ansiColor('xterm')
    disableConcurrentBuilds()
    timeout(time: 90, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
    skipDefaultCheckout(true)
  }

  environment {
    AWS_REGION = "${params.AWS_REGION ?: env.AWS_REGION ?: 'us-east-1'}"
    AWS_ACCOUNT_ID = "${params.AWS_ACCOUNT_ID ?: env.AWS_ACCOUNT_ID ?: ''}"
    ECR_REPOSITORY = "${params.ECR_REPOSITORY ?: env.ECR_REPOSITORY ?: 'app-b-backlog'}"
    ECR_URI = "${AWS_ACCOUNT_ID ? "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}" : ''}"
    ECS_CLUSTER = "${params.ECS_CLUSTER ?: env.ECS_CLUSTER ?: 'blogsphere-cluster'}"
    ECS_SERVICE = "${params.ECS_SERVICE ?: env.ECS_SERVICE ?: 'blogsphere-backend'}"
    IMAGE_NAME = "${params.IMAGE_NAME ?: env.IMAGE_NAME ?: 'app-b-backlog'}"
    SONAR_PROJECT_KEY = "${params.SONAR_PROJECT_KEY ?: env.SONAR_PROJECT_KEY ?: 'App-B-BackLog'}"
    SONAR_PROJECT_NAME = "${params.SONAR_PROJECT_NAME ?: env.SONAR_PROJECT_NAME ?: 'App-B-BackLog'}"
    GIT_REPO_URL = "${params.GIT_REPO_URL ?: env.GIT_REPO_URL ?: 'git@github.com:your-org/your-repo.git'}"
    GIT_BRANCH = "${params.GIT_BRANCH ?: env.GIT_BRANCH ?: 'development'}"
    TRIVY_REPORT_DIR = 'reports'
    AWS_CREDENTIALS_ID = 'aws-credentials'
    SONAR_TOKEN_CREDENTIALS_ID = 'sonarqube-token'
    GITHUB_SSH_CREDENTIALS_ID = 'github-ssh-key'
    GIT_COMMIT_SHA = ''
    GIT_COMMIT_SHORT = ''
    DOCKER_BUILDKIT = '1'
    COMPOSE_DOCKER_CLI_BUILD = '1'
  }

  stages {
    stage('Validate Configuration') {
      steps {
        echo '--- Validating pipeline configuration ---'
        script {
          if (!env.AWS_ACCOUNT_ID?.trim()) {
            error 'AWS_ACCOUNT_ID is required. Provide it as a Jenkins parameter or environment value.'
          }
          if (!env.GIT_REPO_URL?.trim()) {
            error 'GIT_REPO_URL is required.'
          }
        }
      }
    }

    stage('Checkout Source Code') {
      steps {
        echo '--- Checking out source code from GitHub ---'
        echo "Repository: ${GIT_REPO_URL}"
        echo "Branch: ${GIT_BRANCH}"
        sshagent([env.GITHUB_SSH_CREDENTIALS_ID]) {
          retry(2) {
            git branch: env.GIT_BRANCH, url: env.GIT_REPO_URL
          }
        }
      }
    }

    stage('Collect Git and Workspace Info') {
      steps {
        echo '--- Collecting Git and workspace details ---'
        script {
          env.GIT_COMMIT_SHA = sh(script: 'git rev-parse HEAD', returnStdout: true).trim()
          env.GIT_COMMIT_SHORT = sh(script: 'git rev-parse --short=12 HEAD', returnStdout: true).trim()
        }
        sh '''
          set -e
          echo "Workspace: $(pwd)"
          echo "Current branch: $(git rev-parse --abbrev-ref HEAD)"
          echo "Git commit hash: ${GIT_COMMIT_SHA}"
          echo "Git commit short: ${GIT_COMMIT_SHORT}"
          echo "Last commit details:"
          git --no-pager log -1 --decorate --stat
        '''
      }
    }

    stage('Verify Tooling Versions') {
      steps {
        echo '--- Verifying toolchain versions ---'
        sh '''
          set -e
          echo "Node.js: $(node --version)"
          echo "npm: $(npm --version)"
          echo "Docker: $(docker --version)"
          echo "AWS CLI: $(aws --version)"
          echo "Trivy: $(trivy --version)"
          echo "Sonar Scanner: $(sonar-scanner -v)"
        '''
      }
    }

    stage('Install Dependencies') {
      steps {
        echo '--- Installing project dependencies with npm ci ---'
        sh '''
          set -e
          if [ ! -f package-lock.json ]; then
            echo "package-lock.json not found, generating one before npm ci"
            npm install --package-lock-only --no-audit --no-fund
          fi
          npm ci --no-audit --no-fund
        '''
      }
    }

    stage('Lint') {
      steps {
        echo '--- Running lint checks ---'
        sh '''
          set -e
          if npm run | grep -q '^  lint'; then
            npm run lint -- --max-warnings=0
          else
            echo "No lint script detected in package.json; skipping lint step."
          fi
        '''
      }
    }

    stage('Unit Tests with Coverage') {
      steps {
        echo '--- Running unit tests with coverage ---'
        sh '''
          set -e
          mkdir -p reports/junit reports/coverage
          if npm run | grep -q '^  test'; then
            npm run test -- --coverage --ci
          else
            echo "No test script detected in package.json; skipping unit test execution."
          fi
        '''
      }
      post {
        always {
          script {
            if (fileExists('reports/junit/junit.xml')) {
              junit testResults: 'reports/junit/**/*.xml', allowEmptyResults: true
            } else {
              echo 'JUnit report was not generated; skipping JUnit publishing.'
            }
            if (fileExists('reports/coverage/lcov-report/index.html')) {
              publishHTML(target: [
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'reports/coverage/lcov-report',
                reportFiles: 'index.html',
                reportName: 'Coverage Report'
              ])
            } else {
              echo 'Coverage report was not generated; skipping coverage publishing.'
            }
          }
        }
      }
    }

    stage('Run SonarQube Analysis') {
      steps {
        echo '--- Running SonarQube analysis ---'
        withCredentials([string(credentialsId: env.SONAR_TOKEN_CREDENTIALS_ID, variable: 'SONAR_TOKEN')]) {
          withSonarQubeEnv('SonarQube') {
            sh '''
              set -e
              mkdir -p .scannerwork
              sonar-scanner \
                -Dsonar.projectKey=${SONAR_PROJECT_KEY} \
                -Dsonar.projectName=${SONAR_PROJECT_NAME} \
                -Dsonar.sources=src \
                -Dsonar.exclusions=**/node_modules/**,**/dist/**,**/coverage/** \
                -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                -Dsonar.token=$SONAR_TOKEN
            '''
          }
        }
      }
    }

    stage('Wait for SonarQube Quality Gate') {
      steps {
        echo '--- Waiting for SonarQube quality gate ---'
        script {
          timeout(time: 15, unit: 'MINUTES') {
            def qg = waitForQualityGate()
            if (qg.status != 'OK') {
              error "SonarQube quality gate failed with status: ${qg.status}"
            }
          }
        }
      }
    }

    stage('Build Docker Image') {
      steps {
        echo '--- Building Docker image ---'
        echo "Docker image tags: ${IMAGE_NAME}:${BUILD_NUMBER}, ${IMAGE_NAME}:${GIT_COMMIT_SHORT}, ${IMAGE_NAME}:latest"
        sh '''
          set -e
          mkdir -p ${TRIVY_REPORT_DIR}
          export DOCKER_BUILDKIT=1
          export COMPOSE_DOCKER_CLI_BUILD=1
          docker build --pull --build-arg BUILDKIT_INLINE_CACHE=1 --cache-from ${IMAGE_NAME}:latest \
            -t ${IMAGE_NAME}:${BUILD_NUMBER} \
            -t ${IMAGE_NAME}:${GIT_COMMIT_SHORT} \
            -t ${IMAGE_NAME}:latest \
            .
          docker tag ${IMAGE_NAME}:${BUILD_NUMBER} ${ECR_URI}:${BUILD_NUMBER}
          docker tag ${IMAGE_NAME}:${BUILD_NUMBER} ${ECR_URI}:${GIT_COMMIT_SHORT}
          docker tag ${IMAGE_NAME}:${BUILD_NUMBER} ${ECR_URI}:latest
        '''
      }
    }

    stage('Run Trivy Image Scan') {
      steps {
        echo '--- Running Trivy vulnerability scan ---'
        script {
          def scanExitCode = sh(
            script: """
              set -e
              trivy image --format table --severity HIGH,CRITICAL --exit-code 1 --output ${TRIVY_REPORT_DIR}/trivy-report.txt ${IMAGE_NAME}:${BUILD_NUMBER}
            """,
            returnStatus: true
          )
          if (scanExitCode == 0) {
            echo 'No HIGH or CRITICAL vulnerabilities detected by Trivy.'
          } else {
            echo 'HIGH or CRITICAL vulnerabilities detected by Trivy.'
            currentBuild.result = 'FAILURE'
            error 'Trivy found HIGH or CRITICAL vulnerabilities.'
          }
        }
      }
    }

    stage('Generate Trivy Reports') {
      steps {
        echo '--- Generating Trivy reports ---'
        sh '''
          set -e
          trivy image --format json --output ${TRIVY_REPORT_DIR}/trivy-report.json ${IMAGE_NAME}:${BUILD_NUMBER}
          trivy image --format template --template @contrib/html.tpl --output ${TRIVY_REPORT_DIR}/trivy-report.html ${IMAGE_NAME}:${BUILD_NUMBER}
          trivy image --format sarif --output ${TRIVY_REPORT_DIR}/trivy-report.sarif ${IMAGE_NAME}:${BUILD_NUMBER}
        '''
      }
    }

    stage('Login to AWS ECR') {
      steps {
        echo '--- Logging into Amazon ECR ---'
        withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: env.AWS_CREDENTIALS_ID, accessKeyVariable: 'AWS_ACCESS_KEY_ID', secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {
          retry(2) {
            sh '''
              set -e
              aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_URI}
            '''
          }
        }
      }
    }

    stage('Push Images to ECR') {
      steps {
        echo '--- Pushing Docker images to Amazon ECR ---'
        sh '''
          set -e
          docker push ${ECR_URI}:${BUILD_NUMBER}
          docker push ${ECR_URI}:${GIT_COMMIT_SHORT}
          docker push ${ECR_URI}:latest
        '''
      }
    }

    stage('Deploy to ECS') {
      when {
        branch 'development'
      }
      steps {
        echo '--- Updating ECS service with a new deployment ---'
        withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: env.AWS_CREDENTIALS_ID, accessKeyVariable: 'AWS_ACCESS_KEY_ID', secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {
          sh '''
            set -e
            aws ecs update-service --cluster ${ECS_CLUSTER} --service ${ECS_SERVICE} --force-new-deployment --region ${AWS_REGION}
          '''
        }
      }
    }

    stage('Verify ECS Deployment') {
      when {
        branch 'development'
      }
      steps {
        echo '--- Waiting for ECS service stability ---'
        withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: env.AWS_CREDENTIALS_ID, accessKeyVariable: 'AWS_ACCESS_KEY_ID', secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {
          sh '''
            set -e
            aws ecs wait services-stable --cluster ${ECS_CLUSTER} --services ${ECS_SERVICE} --region ${AWS_REGION}
            aws ecs describe-services --cluster ${ECS_CLUSTER} --services ${ECS_SERVICE} --region ${AWS_REGION} --output json > service.json
            python3 - <<'PY'
import json
import sys
from pathlib import Path

service_path = Path('service.json')
if not service_path.exists():
    raise SystemExit('ECS service description file was not generated.')

with service_path.open('r', encoding='utf-8') as handle:
    data = json.load(handle)

service = data['services'][0]
running_count = service.get('runningCount', 0)
desired_count = service.get('desiredCount', 0)
status = service.get('status', 'UNKNOWN')

print(f"Deployment verification: status={status}, runningCount={running_count}, desiredCount={desired_count}")
if status != 'ACTIVE' or running_count < desired_count:
    raise SystemExit('ECS deployment verification failed.')
PY
          '''
        }
      }
    }

    stage('Cleanup Build Artifacts') {
      steps {
        echo '--- Cleaning up only build-specific Docker images ---'
        sh '''
          set -e
          docker image rm ${IMAGE_NAME}:${BUILD_NUMBER} ${IMAGE_NAME}:${GIT_COMMIT_SHORT} ${IMAGE_NAME}:latest 2>/dev/null || true
          docker image rm ${ECR_URI}:${BUILD_NUMBER} ${ECR_URI}:${GIT_COMMIT_SHORT} ${ECR_URI}:latest 2>/dev/null || true
        '''
      }
    }
  }

  post {
    always {
      echo '--- Archiving reports and finalizing pipeline ---'
      script {
        try {
          archiveArtifacts artifacts: "${TRIVY_REPORT_DIR}/**", allowEmptyArchive: true
        } catch (err) {
          echo "Report archiving skipped: ${err}"
        }
      }
      echo "Total execution time: ${currentBuild.durationString}"
    }

    success {
      echo 'Pipeline completed successfully.'
    }

    failure {
      echo 'Pipeline failed. Review the SonarQube results, Trivy reports, and ECS deployment status.'
    }

    cleanup {
      echo '--- Cleaning the Jenkins workspace ---'
      cleanWs()
    }
  }
}
