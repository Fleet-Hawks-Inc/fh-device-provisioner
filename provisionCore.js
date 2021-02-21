// ES5 example
const {
  GreengrassClient,
  CreateGroupCommand,
  DeleteGroupCommand,
  CreateCoreDefinitionCommand,
  DeleteCoreDefinitionCommand,
  CreateFunctionDefinitionCommand,
  DeleteFunctionDefinitionCommand,
  AssociateRoleToGroupCommand,
} = require("@aws-sdk/client-greengrass");

const {
  IoTClient,
  CreatePolicyCommand,
  CreateThingCommand,
  DeleteThingCommand,
  CreateKeysAndCertificateCommand,
  UpdateCertificateCommand,
  DeleteCertificateCommand,
  AttachPolicyCommand,
  AttachThingPrincipalCommand,
  DetachPolicyCommand,
} = require("@aws-sdk/client-iot");
const uniqid = require("uniqid");
const { program } = require("commander");
const http = require("https"); // or 'https' for https:// URLs
const fs = require("fs");
var colors = require("colors");
const chalk = require("chalk");
const { config } = require("aws-sdk");

const THING_PREFIX = "fh-thing";
const GROUP_NAME_PREFIX = "fh-group";
let NAME = "CORE_NAME";

(async () => {
  let gccClient;
  let iotClient;
  let thingName;
  let certificateId;
  let coreDefinitionId;
  let functionDefinitionId;
  let coreGroupId;
  let policyName;
  try {
    program
      .description(
        "******" +
          "FleetHawks - GreenGrass Provisioner : Provisions MiniEld with FleetHawks Cloud" +
          "******"
      )
      .requiredOption("-c, --coreName <coreName>", "Mini Eld Core Name ")
      .requiredOption("-a, --accessKey <accessKey>", "AWS Access Key ID")
      .requiredOption(
        "-s, --secretAccessKey <secretAccessKey>s",
        "AWS Secret Access Key (Required)"
      )
      .requiredOption(
        "-r, --region",
        "AWS region where to deploy.",
        "us-east-2"
      )
      .option("-d, --debug", "Print stack strace");

    program.parse(process.argv);
    const options = program.opts();
    console.log(
      "FleetHawks - GreenGrass Provisioner : Provisions MiniEld with FleetHawks Cloud"
        .blue
    );
    NAME = options.coreName.toLowerCase();
    const AWS_ACCESS_KEY_ID = options.accessKey;
    const AWS_SECRET_ACCESS_KEY = options.secretAccessKey;
    const AWS_REGION = options.region;

    const credentials = {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    };
    // a client can be shared by difference commands.
    gccClient = new GreengrassClient({
      region: AWS_REGION,
      credentials: credentials,
    });

    iotClient = new IoTClient({
      region: AWS_REGION,
      credentials: credentials,
    });
    // Create IOT Thing
    const iotThing = new CreateThingCommand({
      thingName: `${THING_PREFIX}-${NAME}-thing`,
    });
    var iotThingResp = await iotClient.send(iotThing);
    thingName = iotThingResp.thingName;

    // console.log("IOT Thing Created", iotThingResp);
    console.log("IOT Thing Created".green, iotThingResp.thingName);
    // Create Key and Certificate
    const iotCertKey = new CreateKeysAndCertificateCommand({
      setAsActive: true, // True for now
    });

    const iotCertKeyResp = await iotClient.send(iotCertKey);
    certificateId = iotCertKeyResp.certificateId;
    //console.log("IOT Cert & Key Created", iotCertKeyResp);
    console.log("IOT Cert & Key Created".green, iotCertKeyResp.certificateId);

    const createPolicyCmd = new CreatePolicyCommand({
      policyName: `fh-policy-${uniqid()}`,
      policyDocument:
        '{\n  "Version": "2012-10-17",\n  "Statement": [\n    {\n      "Effect": "Allow",\n      "Action": [\n        "iot:Publish",\n        "iot:Subscribe",\n        "iot:Connect",\n        "iot:Receive"\n      ],\n      "Resource": "*"\n    },\n    {\n      "Effect": "Allow",\n      "Action": [\n        "iot:GetThingShadow",\n        "iot:UpdateThingShadow",\n        "iot:DeleteThingShadow"\n      ],\n      "Resource": "*"\n    },\n    {\n      "Effect": "Allow",\n      "Action": "greengrass:*",\n      "Resource": "*"\n    }\n  ]\n}',
    });
    const iotPolicy = await iotClient.send(createPolicyCmd);
    policyName = iotPolicy.policyName;
    const iotAttachPolicy = new AttachPolicyCommand({
      policyName: iotPolicy.policyName,
      target: iotCertKeyResp.certificateArn,
    });

    const attachPolicyResponse = await iotClient.send(iotAttachPolicy);
    // console.log("IOT Policy Attached", attachPolicyResponse);
    console.log("IOT Policy Attached".green);

    const iotAttachPrinpl = new AttachThingPrincipalCommand({
      principal: iotCertKeyResp.certificateArn,
      thingName: iotThingResp.thingName,
    });
    const iotAttachPcplResp = await iotClient.send(iotAttachPrinpl);
    console.log("IOT Principal Attached".green);

    // Create GCC Core Definition
    const gccCoreDef = new CreateCoreDefinitionCommand({
      Name: `${GROUP_NAME_PREFIX}-${NAME}-core-definition`,

      InitialVersion: {
        Cores: [
          {
            CertificateArn: iotCertKeyResp.certificateArn,
            ThingArn: iotThingResp.thingArn,
            Id: iotThingResp.thingId,
            SyncShadow: true,
          },
        ],
      },
    });
    const gccCoreDefResponse = await gccClient.send(gccCoreDef);
    coreDefinitionId = gccCoreDefResponse.Id;
    console.log("Green Grass Core Definition Created".green);
    const eldService = new CreateFunctionDefinitionCommand({
      InitialVersion: {
        DefaultConfig: {
          Execution: {
            IsolationMode: "NoContainer",
            RunAs: {
              Gid: 0,
              Uid: 0,
            },
          },
        },
        Functions: [
          {
            Id: uniqid(),
            FunctionArn:
              "arn:aws:lambda:us-east-2:112567001577:function:fh-eld-service-dev-execute:28",

            FunctionConfiguration: {
              Pinned: true,
              Timeout: 300,
              Environment: {
                Variables: {
                  DEVICE_MODE: true,
                },
              },
            },
          },
          {
            Id: uniqid(),
            FunctionArn:
              "arn:aws:lambda:us-east-2:112567001577:function:fh-eld-dashboard-dev-execute:6",

            FunctionConfiguration: {
              Pinned: true,
              Timeout: 300,
            },
          },
        ],
      },
    });

    const gccFunctionResponse = await gccClient.send(eldService);
    functionDefinitionId = gccFunctionResponse.Id;
    const gccCoreGroup = new CreateGroupCommand({
      Name: `${GROUP_NAME_PREFIX}-${NAME}-group`,
      InitialVersion: {
        CoreDefinitionVersionArn: gccCoreDefResponse.LatestVersionArn,
        FunctionDefinitionVersionArn: gccFunctionResponse.LatestVersionArn,
      },
    });

    const gccCoreGroupResponse = await gccClient.send(gccCoreGroup);
    coreGroupId = gccCoreGroupResponse.Id;

    let RoleArn =
      "arn:aws:iam::112567001577:role/service-role/Greengrass_ServiceRole";
    const atachRole = await gccClient.send(
      new AssociateRoleToGroupCommand({
        GroupId: coreGroupId,
        RoleArn: RoleArn,
      })
    );
    console.log("GreenGrass Role attached successfully".green);
    //write file
    var hash = uniqid();
    const certDir = "certs";
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir);
    }

    fs.writeFileSync(
      `certs/${hash}.privatekey`,
      iotCertKeyResp.keyPair.keyPair.PrivateKey
    );
    await fs.writeFileSync(
      `certs/${hash}.publickey`,
      iotCertKeyResp.keyPair.PublicKey
    );
    await fs.writeFileSync(
      `certs/${hash}.cert.pem`,
      iotCertKeyResp.certificatePem
    );
    const file = fs.createWriteStream("certs/root.ca");
    http.get(
      "https://www.amazontrust.com/repository/AmazonRootCA1.pem",
      function (response) {
        response.pipe(file);
      }
    );
    // Updating config
    var configTemplate = fs.readFileSync("config.template.json", "utf-8");
    let configFile = configTemplate
      .replace(/REGION/g, AWS_REGION)
      .replace(/THING_ARN/g, iotThingResp.thingArn)
      .replace(/PRIVATE_KEY/g, `${hash}.privatekey`)
      .replace(/PEM_CERT/g, `${hash}.cert.pem`);
    const configDir = "config";
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir);
    }
    fs.writeFileSync("config/config.json", configFile);
    console.log(
      "Config file generated successfully generated in config directory.".green
    );
    console.log(
      "Mini Eld provisioned with AWS Cloud. Please go to console and trigger deployment"
        .green
    );
  } catch (error) {
    console.log("Error occurred".red, error);
    console.log("Rolling back changes ..... ..".red);
    if (thingName) {
      await iotClient.send(new DeleteThingCommand({ thingName: thingName }));
    }
    if (certificateId) {
      await iotClient.send(
        new UpdateCertificateCommand({
          certificateId: certificateId,
          newStatus: "INACTIVE",
        })
      );
      if (policyName) {
        await iotClient.send(
          new DetachPolicyCommand({ policyName: policyName })
        );
      }

      await iotClient.send(
        new DeleteCertificateCommand({
          certificateId: certificateId,
          forceDelete: true,
        })
      );
    }
    if (functionDefinitionId) {
      await gccClient.send(
        new DeleteFunctionDefinitionCommand({
          FunctionDefinitionId: functionDefinitionId,
        })
      );
    }
    if (coreDefinitionId) {
      await gccClient.send(
        new DeleteCoreDefinitionCommand({ CoreDefinitionId: coreDefinitionId })
      );
    }
    if (coreGroupId) {
      await gccClient.send(new DeleteGroupCommand({ GroupId: coreGroupId }));
    }

    console.log(error);
    throw new Error(error);
  }
})();
